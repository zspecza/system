var fs      = require('fs');
var path    = require('path');
var _       = require('lodash');
var node    = require('when/node');
var postcss = require('postcss');

/**
 * @class SystemCSS
 * @classdesc creates a new SystemCSS instance
 */
var SystemCSS = (function SystemCSS() {

  /**
   * @constructs SystemCSS
   */
  function SystemCSS() {
    this.settings = {
      preprocessor: {
        output    : '.',
        engine    : null,
        namespace : '',
        filename  : 'system',
        ext       : null,
        dest      : null,
      },
      root: '#system',
      mixins: {
        block    : 'component',
        element  : 'has',
        modifier : 'when',
        state    : 'is',
        context  : 'inside',
        util     : 'util',
        parent   : 'container'
      },
      prefixes: {
        block    : '.',
        element  : '--',
        modifier : '.\\+',
        state    : ':',
        context  : '.\\@',
        util     : '.\\~',
        parent   : '.\\@'
      },
      suffixes: {
        block    : '',
        element  : '',
        modifier : '',
        state    : '',
        context  : '',
        util     : '',
        parent   : ''
      },
      extensions: {
        sass   : 'sass',
        scss   : 'scss',
        stylus : 'styl',
        less   : 'less'
      },
      protectedStates: [
        'enabled',
        'disabled',
        'checked',
        'required',
        'visited'
      ],
      matcher: /([^(]+)\(([^\:]+)\)\:?(\S+)?/
    };
  }

  /**
   * creates a file containing mixins for the chosen CSS preprocessor
   * and writes them out to the provided output path
   * @param  {Object} opts={} SystemCSS settings
   * @return {Promise} a promise for the written mixins file
   */
  SystemCSS.prototype.mixins = function mixins(opts) {
    this.settings = _.merge(this.settings, opts);
    if (this.settings.preprocessor.engine == null) {
      throw new Error("Please specify the name of the CSS preprocessor you wish to receive mixins for.");
    }
    if (this.settings.preprocessor.output === '.') {
      throw new Error("Pleace specify a directory path. SystemCSS cannot write your mixins to a directory it does not know.")
    }
    return readTemplate()
      .with(this)
      .then(registerTemplate)
      .then(injectTemplateDataAndCompile)
      .then(cleanTemplate)
      .then(writeTemplate)
      .catch(throwErr);
  };

  /**
   * reads in the `system.template` preprocessor mixin template file as UTF-8
   * @return {Promise} a promise for the template
   */
  function readTemplate() {
    return node.call(fs.readFile, path.join(__dirname, 'templates/system.template'), {
      encoding: 'utf-8'
    });
  }

  /**
   * creates a function that will compile a template, injecting any passed data
   * @param  {String} source - the source for the template as a UTF-8 string
   * @return {Function} the compilation function
   */
  function registerTemplate(source) {
    return _.template(source);
  }

  /**
   * injects SystemCSS settings data into a template function and compiles the template
   * @param  {Function} template - the template compilation function
   * @return {String} the compiled template source
   */
  function injectTemplateDataAndCompile(template) {
    return template(_.extend({ _ : _ }, this.settings));
  }

  /**
   * removes unneccessary whitespace from the template source
   * @param  {String} str - the compiled template
   * @return {String} the cleaned compiled template
   */
  function cleanTemplate(str) {
    return _.chain(str.split('\n')).compact().join('\n').trim().value();
  }

  /**
   * saves the compiled template to the SystemCSS settings output dir
   * @param  {String} str - the compiled template source
   * @return {Promise} a promise for the written file
   */
  function writeTemplate(str) {
    var settings = this.settings;
    var preprocessor = settings.preprocessor;
    this.settings.preprocessor.ext = settings.extensions[preprocessor.engine];
    this.settings.preprocessor.dest = path.join(
      preprocessor.output, preprocessor.filename + '.' + preprocessor.ext
    ); 
    return node.call(fs.writeFile, preprocessor.dest, str);
  }

  /**
   * throws an error
   * @param  {Object} err - instance of Error
   */
  function throwErr(err) {
    throw err;
  }

  /**
   * registers a PostCSS plugin
   * @param  {Object} opts={} - SystemCSS settings
   * @return {Function} the SystemCSS PostCSS plugin
   */
  SystemCSS.prototype.postcss = function(opts) {
    var opts = opts || {};
    return postcss.plugin('SystemCSS', plugin.bind(this)).call(null, opts);
  };

  /**
   * PostCSS plugin definition callback
   * @param  {Object} opts=this.settings - SystemCSS settings
   * @return {Function} the CSS transform function
   */
  function plugin(opts) {
    this.settings = _.merge(this.settings, opts);
    return cssTransform.bind(this);
  }

  /**
   * transforms each CSS rule
   * @param  {Object} css - the CSS syntax tree
   * @return {Object} the CSS syntax tree
   */
  function cssTransform(css) {
    css.eachRule(transformRule.bind(this));
    return css;
  }

  /**
   * compiles the SystemCSS DSL to regular CSS selectors
   * @param  {String} rule - the CSS rule to transform
   */
  function transformRule(rule) {
    rule.selector = compileSelector.call(this, expandSelector.call(this, rule.selector));
  }

  /**
   * expands the selector such that `component(one, two) has(part, element) {}`
   * becomes:
   * ```
   * component(one) has(part),
   * component(one) has(element),
   * component(two) has(part),
   * component(two) has(element) {}
   * ```
   * @param  {String} selector - the SystemCSS selector to expand
   * @return {String} the expanded selector
   */
  function expandSelector(selector) {

    var needsExpansion = false, i;
    var split = selector.replace(/\,\s/g, ',').split(' ');

    // detect if this selector actually needs expansion,
    // else just return the selector
    for (i = 0; i < split.length; i++) {
      var match = split[i].match(this.settings.matcher);
      if (match != null) needsExpansion = true;
    }

    if (needsExpansion) {
      var targets = _(split)
        .chain()
        .collect(createDefinition.bind(this))
        .collect(expandDefinitionArguments)
        .value();

      if (targets.length > 1) {
        while(targets.length) {
          var current = targets.pop();
          var index = targets.length - 1;
          var previous = targets[index];
          targets[index] = _(previous)
            .chain()
            .collect(duplicatePreviousTarget.bind(current))
            .flatten()
            .value();
          if (index === 0) break;
        }
      }

      return targets[0].join(',\n');

    } else {
      return selector;
    }
  }

  /**
   * creates a tiny syntax definition that describes a single
   * SystemCSS method call
   * @param  {String} target - the method to transform into a definition
   * @return {Object} the AST
   * @example
   * `component(one, two):hover` becomes:
   * `{ method: 'component', args: ['one', 'two'], pseudo: ':hover' }`
   */
  function createDefinition(target) {
    var match = target.match(this.settings.matcher);
    return {
      method: match[1],
      args: match[2].split(','),
      pseudo: (match[3] == null ? '' : ':' + match[3])
    }
  }

  /**
   * expands a target definitions arguments into an array of separate
   * calls to the method for each argument
   * @param  {Object} definition - the method syntax definition
   * @return {Array} a list of method calls for each argument
   * @example
   * `{ method: 'component', args: ['one', 'two'], pseudo: ':hover' }`
   * becomes:
   * ['component(one):hover', 'component(two):hover']
   */
  function expandDefinitionArguments(definition) {
    return _.collect(definition.args, wrapArgument.bind(definition));
  }

  /**
   * wraps each method definition argument in a call to that method
   * @param  {String} arg - the argument in question
   * @return {String} the wrapped method call
   */
  function wrapArgument(arg) {
    return this.method + '(' + arg + ')' + this.pseudo;
  }

  /**
   * duplicates the previous target of a selector enough times to
   * equal the amount of targets in the current selector
   * and then concatenates the current target on to each previous target
   * @param  {String} el - the previous target
   * @return {Array} an array of the concatenated targets
   */
  function duplicatePreviousTarget(el) {
    var currentLen = this.length, els = [], i;
    for (i = 0; i < currentLen; i++) els.push(el);
    return _.collect(els, concatenateCurrentTarget.bind(this));
  }

  /**
   * concatenates the current target with the previous target
   * @param  {String} el - the previous target
   * @param  {Number} i - index of the current target in the targets array
   * @return {String} the concatenated target
   */
  function concatenateCurrentTarget(el, i) {
    return el + ' ' + this[i];
  }

  /**
   * compiles an expanded SystemCSS DSL selector to CSS
   * @param  {String} selector - the  expanded selector
   * @return {String} the compiled CSS selector
   */
  function compileSelector(selector) {
    return _.collect(selector.split(',\n'), splitTargets.bind(this)).join(',\n');
  }

  /**
   * splits the targets of a SystemCSS selector and transforms the target to CSS
   * @param  {String} targets - the targets of the SystemCSS selector
   * @return {String} the transformed targets
   */
  function splitTargets(targets) {
    var output = '';
    targets = _.collect(targets.split(' '), getAbstraction.bind(this));
    _.each(targets, transformTarget.bind(this));

    /**
     * transforms a target abstraction into the desired CSS output
     * @param  {Object} current - the current target abstraction
     * @param  {Number} index - the index of the current target in the targets array
     * @return {String} the desired CSS output
     */
    function transformTarget(current, index) {

      var previous             = targets[index - 1] || {};
      var isOtherType          = current.type === 'other' || previous.type === 'other';
      var elementInModifier    = current.type === 'element' && previous.type === 'modifier';
      var blockInContext       = current.type === 'context' && previous.type === 'block';
      var elementInParentState = previous.type === 'state' && current.type === 'element';
      var spacing              = '';

      // normalize state name grammar such that "hovered" becomes "hover" and so on
      if (current.type === 'state') {
        current.name = _.collect(current.name.split(':'), normalizeState.bind(this)).join(':');
      }

      // spacing required after pseudo-selectors
      if (current.pseudo) {
        spacing = ' ';
        output += joinTargetProps(current) + spacing;
        return;
      }

      // regular spacing before and after non-systemCSS selectors
      if (isOtherType) spacing = ' ';

      // ensure correct output for elements belonging to modified blocks,
      // as well as elements reacting to blocks with state
      if (elementInModifier || elementInParentState) {
        // get the block this target belongs to
        var block = _.detect(targets, { type: 'block' });
        spacing = ' ';
        output += spacing + joinTargetProps(block) + joinTargetProps(current);
        return;
      }

      // reverse the order of the targets in a selector for a block inside a container
      if (blockInContext) {
        spacing = ' ';
        output = joinTargetProps(current) + spacing + joinTargetProps(previous);
        return;
      }

      // otherwise just compile the selector
      output += spacing + joinTargetProps(current);

    }

    // clean any whitespace surrounding the output
    return output.trim();
  }

  /**
   * normalizes state names, e.g. "hovered" becomes 
   * "hover", "focused" becomes "focus" etc...
   * does not touch states that are present in settings.protectedStates
   * @param  {String} state - the state to normalize
   * @return {String} the normalized state
   */
  function normalizeState(state) {
    var arr = state.split('(');
    if (!_.contains(this.settings.protectedStates, arr[0])) {
      arr[0] = arr[0].replace('ed', '');
    }
    return arr.join('(');
  }

  /**
   * transforms a SystemCSS selector target into an abstraction
   * @param  {String} target - the target to abstract
   * @return {Object} the abstraction
   * @example
   * `component(tweet):hover,` becomes
   * ```
   * {
   *   type: 'block',
   *   name: 'tweet',
   *   pseudo: ':hover',
   *   comma: ', ',
   *   prefix: '.',
   *   suffix: ''
   * }
   * ```
   */
  function getAbstraction(target) {
    var prefixes = {
      block: this.settings.prefixes.block,
      element: this.settings.prefixes.element,
      modifier: this.settings.prefixes.modifier,
      state: this.settings.prefixes.state,
      context: this.settings.root + ' ' + this.settings.prefixes.context,
      util: this.settings.root + ' ' + this.settings.prefixes.util,
      parent: this.settings.prefixes.parent
    }
    var resolved = _(this.settings.mixins)
      .chain()
      .keys()
      .collect(matchMethodTypes.bind(this, target))
      .value();
    var match = _.select(resolved, getFirstMatch)[0];
    if (!match) return { type: 'other', name: target, prefix: '', suffix: '' };
    return {
      type: match.type,
      name: match.match[2],
      pseudo: (match.match[3] != null) ? match.match[3] : '',
      prefix: prefixes[match.type],
      suffix: this.settings.suffixes[match.type]
    };
  }

  /**
   * returns a matcher definition for a SystemCSS method
   * @param  {String} type - the type of method to match
   * @return {Object} the matched definition
   */
  function matchMethodTypes(target, type) {
    var method = this.settings.mixins[type];
    var re = new RegExp('(' + method + '\\(([^)]*)\\)(\\:.+)?(\\,)?)');
    return { type: type, match: target.match(re) };
  }

  /**
   * detect if the method matches the selector
   * @param  {Object} potential - the potential match to detect
   * @return {Boolean} true if is a match
   */
  function getFirstMatch(potential) {
    return potential.match;
  }


  /**
   * combines a target abstraction into a usable CSS selector string
   * @param  {Object} target - the target definition
   * @param  {Boolean} usePseudo - should pseudo-elements / pseudo-selectors be included?
   * @return {String} the css selector representing this target
   */
  function joinTargetProps(target) {
    return target.prefix +
           target.name +
           target.suffix +
           (target.pseudo ? target.pseudo : '');
  }

  return SystemCSS;

}).call(this);

module.exports = new SystemCSS();
