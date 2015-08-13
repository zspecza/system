var path    = require('path');
var _       = require('lodash');
var postcss = require('postcss');
var chai    = require('chai');
var node    = require('when/node');
var fs      = require('fs');
var plugin  = require('../lib');
var nested  = require('postcss-nested');
var promise = require('chai-as-promised');
var expect  = chai.expect;

chai.use(promise);

var FIXTURES_PATH = path.join(__dirname, 'fixtures');
var MIXIN_PATH    = path.join(FIXTURES_PATH, 'mixins');

function match_files(file1, file2) {
  var inp = fs.readFileSync(file1, { encoding: 'utf-8' }).trim();
  var out = fs.readFileSync(file2, { encoding: 'utf-8' }).trim();
  expect(inp).to.equal(out);
}

function test(input, output, opts, done) {
  postcss([nested, plugin.postcss(opts)]).process(input).then(function(result) {
    expect(result.css).to.eql(output);
    expect(result.warnings()).to.be.empty;
    done();
  }).catch(function (error) {
    done(error);
  });
}

function match_expected(filename, opts, done) {
  var input = fs.readFileSync(path.join(FIXTURES_PATH, filename + '.pcss'), { encoding: 'utf-8' });
  var output = fs.readFileSync(path.join(FIXTURES_PATH, filename + '.css'), { encoding: 'utf-8' });
  test(input, output, opts, done);
}

var defaultSettings = {
  mixins: {
    block: 'component',
    element: 'has',
    modifier: 'when',
    state: 'is',
    context: 'inside',
    util: 'util',
    parent: 'container'
  },
  preprocessor: {
    namespace: ''
  }
};

describe('SystemCSS', function() {

  describe('preprocessor supplementation', function() {

    it('should throw when calling without the right options', function() {
      expect(plugin.mixins.bind(plugin, {
        preprocessor: {
          engine: null
        }
      })).to.throw('Please specify the name of the CSS preprocessor you wish to receive mixins for.');
      expect(plugin.mixins.bind(plugin, {
        preprocessor: {
          engine: 'stylus'
        }
      })).to.throw('Pleace specify a directory path. SystemCSS cannot write your mixins to a directory it does not know.');
    });

    it('should be rejected if an error occurs', function() {
      expect(plugin.mixins({
        preprocessor: {
          engine: 'fake-engine',
          output: 'fake-output'
        }
      }).then(function() {
        throw new Error('Some fake error...');
      })).to.be.rejected;
    });

    _.each(['sass', 'scss', 'less', 'stylus'], function(preprocessor) {

      describe(preprocessor, function() {

        afterEach(function() { plugin.settings = _.merge(plugin.settings, defaultSettings); });

        it('creates a supplementary file of ' + preprocessor + ' mixins at the given path', function(done) {
          plugin.mixins({
            preprocessor: {
              engine: preprocessor,
              filename: 'system-generated',
              output: MIXIN_PATH
            }
          })
          .then(function() {
            match_files(plugin.settings.preprocessor.dest, plugin.settings.preprocessor.dest.replace('-generated', ''));
          }).done(done, done);
        });

        it('supports namespacing', function(done) {
          plugin.mixins({
            preprocessor: {
              engine: preprocessor,
              filename: 'system-namespaced-generated',
              output: MIXIN_PATH,
              namespace: 'namespace-'
            }
          })
          .then(function() {
            match_files(plugin.settings.preprocessor.dest, plugin.settings.preprocessor.dest.replace('-generated', ''));
          }).done(done, done);
        });

        it('supports custom mixin names', function(done) {
          plugin.mixins({
            preprocessor: {
              engine: preprocessor,
              filename: 'system-custom-generated',
              output: MIXIN_PATH
            },
            mixins: {
              block: 'new',
              element: 'part',
              modifier: 'option',
              state: 'state',
              context: 'area',
              util: 'tweak'
            }
          })
          .then(function() {
            match_files(plugin.settings.preprocessor.dest, plugin.settings.preprocessor.dest.replace('-generated', ''));
          }).done(done, done);

        });
      });
    });

  });

  describe('PostCSS', function() {

    it('supports calling with no options param', function(done) {
      test('.test {}', '.test {}', null, done);
    });

    describe('all', function() {

      it('supports multiple arguments', match_expected.bind(null, 'multiple-args', {}));

      it('supports pseudo-selectors', match_expected.bind(null, 'pseudo-selectors', {}));

      it('does not transform regular CSS selectors', match_expected.bind(null, 'css-selectors', {}));

    });

    describe('block', function() {

      it('compiles to the correct output', match_expected.bind(null, 'block/basic', {}));

    });

    describe('element', function() {

      it('compiles to the correct output', match_expected.bind(null, 'element/basic', {}));

      it('supports nested elements', match_expected.bind(null, 'element/nested', {}));

      it('supports elements in modifiers', match_expected.bind(null, 'element/modified-parent', {}));

      it('supports elements with a parent that has state', match_expected.bind(null, 'element/parent-with-state', {}));

    });

    describe('modifier', function() {

      it('compiles to the correct output', match_expected.bind(null, 'modifier/basic', {}));

    });

    describe('state', function() {

      it('compiles to the correct output', match_expected.bind(null, 'state/basic', {}));

      it('does not transform protected states', match_expected.bind(null, 'state/protected', {}));

    });

    describe('context', function() {

      it('compiles to the correct output', match_expected.bind(null, 'context/basic', {}));

    });

    describe('parent', function() {

      it('compiles to the correct output', match_expected.bind(null, 'parent/basic', {}));

    });

    describe('util', function() {

      it('compiles to the correct output', match_expected.bind(null, 'util/basic', {}));

    });

  });

});
