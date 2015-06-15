[![Build Status](https://travis-ci.org/declandewet/system.svg?branch=master)](https://travis-ci.org/declandewet/system)
[![NPM version](https://badge.fury.io/js/postcss-system.svg)](http://badge.fury.io/js/postcss-system)
[![Dependency Status](https://david-dm.org/declandewet/system.svg)](https://david-dm.org/declandewet/system)
[![devDependency Status](https://david-dm.org/declandewet/system/dev-status.svg)](https://david-dm.org/declandewet/system#info=devDependencies)
[![Coverage Status](https://coveralls.io/repos/declandewet/system/badge.png?branch=master)](https://coveralls.io/r/declandewet/system)

system
=========

> **please note**, this module is in its early development phase and will likely change frequently.

`system` is a [PostCSS](//github.com/postcss/postcss) plugin developed at [io](http://io.co.za) that allows you to augment your CSS with a syntax that aids in creating BEM-compliant front-end components and reads like a class definition.

`system` essentially transforms this...

```stylus
component(tweet) has(profile) {
  border: 1px solid #eee;
}
component(tweet) when(featured) has(profile) {
  border-color: yellow;
}
```

...into this:

```css
.tweet--profile {
  border: 1px solid #eee;
}
.tweet.\+featured .tweet--profile {
  border-color: yellow;
}
```

Combined with [postcss-nested](//github.com/postcss/postcss-nested) (which is loaded **before** `system`), the syntax looks something like this:

```stylus
component(tweet) {
  has(profile) {
    border: 1px solid #eee;
  }
  when(featured) {
    has(profile) {
      border-color: yellow;
    }
  }
}
``` 

For more features, check out the [API](#system-api). 

## Inspiration & Credit

This is inspired by, and very similar to another library called [CSStyle](//github.com/geddski/csstyle) by [Dave Geddes](https://github.com/geddski).

Further inspiration comes from wanting to use BEM without sacrificing the power of the cascade, which BEM supplements, rather than augments. Following the `system` syntax will ensure that you never have to worry about using `!important` or loading your components in any specific order, as long as your
top-most document element (e.g. `body`) has an `id` attribute of `system`.

>**Why re-invent the wheel?**
>We needed a completely customisable version of CSStyle that could be used from any preprocessor *and* shares a single code base, because some of our developers have varying toolsets, and we also have ideas that will eventually deviate system from being too similar to CSStyle. Right now, `system` already supports multiple arguments, two extra methods ([`container`](#containerargs) for setting styles directly on a container, and [`is`](#isargs) for setting element state), the ability to output [mixins](#mixins-api) for all 3 major preprocessors that transform to the required PostCSS syntax and is so customizable you can even [**change the API**](#options).

# Installation

`system` can be installed with [npm](http://npmjs.org), which comes pre-installed with [Node.js](http://nodejs.org)

```sh
$ npm install postcss-system --save-dev
```

# Usage

`system` is supported anywhere PostCSS is supported. This means you can use it from Gulp, Grunt, plain JavaScript, etc.

```js
var postcss = require('postcss');
var system = require('postcss-system');
var nested = require('postcss-nested');

postcss([nested, system.postcss/*([options={}])*/]);
```

## JavaScript API

### `system.postcss([settings:Object])`

This method registers `system` as a PostCSS plugin, and is responsible for transforming your CSS. Typically, you would pass this method to your PostCSS plugin pipeline, after `postcss-nested` (that is, if you're using `postcss-nested`), either as a plain function reference (`system.postcss`) or a function call (`system.postcss()`).

It accepts an optional `settings` object. For more info, check out [Options](#options).

Example:

```js
postcss([system.postcss({root: '#root'})]);
```

### `system.mixins(settings:Object)`

This method accepts a compulsory `settings` object, this is the same object one might pass to `system.postcss`, however `settings.preprocessor.output` and `settings.preprocessor.engine` are required in order for this to work. Check out [Options](#options) for more details.

Given the correct details, it will output a mixins file for your chosen CSS preprocessor `engine` to the `output` path, that you can then `@import` and use to compile down to PostCSS syntax. This method is only useful if you have a CSS build task that involves piping preprocessor output to PostCSS.

Be sure to call this before `system.postcss`. Any settings passed to this method will be inherited by `system.postcss`.

It also returns a promise.

Example:

```js
system.mixins({
  preprocessor: {
    engine: 'stylus',
    output: path.join(__dirname, 'assets', 'styles')
  }
});
```

Then, at the top of your main Stylus file:

```stylus
@import 'system'
```

This works for `sass`, `scss` and `less` too.

## Options

Here are the default options for `system`:

```js
{
      preprocessor: {
        output    : '.', // the output path for the system mixins file
        engine    : null, // what css preprocessor you're using
        namespace : '', // a namespace to prepend to each method
        filename  : 'system' // the name of the mixins file
      },
      root: '#system', // the ID attribute for the root node
      mixins: { // yes, you can customise the names of each method
        block    : 'component',
        element  : 'has',
        modifier : 'when',
        state    : 'is',
        context  : 'inside',
        util     : 'util',
        parent   : 'container'
      },
      prefixes: { // and choose your own prefixes
        block    : '.',
        element  : '--',
        modifier : '.\\+',
        state    : ':',
        context  : '.\\@',
        util     : '.\\~',
        parent   : '.\\@'
      },
      suffixes: { // and suffixes
        block    : '',
        element  : '',
        modifier : '',
        state    : '',
        context  : '',
        util     : '',
        parent   : ''
      },
      extensions: { // what file extension to use for your mixins file
        sass   : 'sass',
        scss   : 'scss',
        stylus : 'styl',
        less   : 'less'
      },
      protectedStates: [ // these are not transformed by the `state` method
        'enabled',
        'disabled',
        'checked',
        'required',
        'visited'
      ]
    }
```

## System API

### `component(args...)`

Creates a component.

```stylus
component(tweet) {
  color: blue;
}
```

```css
.tweet {
  color: blue
}
```

```html
<div class="tweet">...</div>
```

### `has(args...)`

A `component` block `has` an element. An element sometimes also `has` an element.

```stylus
component(tweet) {
  has(avatar) {
    border-radius: 50%;
    has(edit-icon) {
      background: url('wrench.png');
    }
  }
}
```

```css
.tweet--avatar {
  border-radius: 50%;
}
.tweet--avatar--edit-icon {
  background: url('wrench.png');
}
```

```html
<div class="tweet">
  <div class="tweet--avatar">
    <i class="tweet--avatar--edit-icon" />
  </div>
</div>
```

### `when(args...)`

`when` a block or element is modified, it's styles are overriden. An element can also react to it's parent block's modifier.

```stylus
component(tweet) {
  color: blue;
  when(featured) {
    color: yellow;
    has(avatar) {
      border: 1px solid yellow;
    }
  }
  has(avatar) {
    border-radius: 0;
    when(circular) {
      border-radius: 50%;
    }
  }
}
```

```css
.tweet {
  color: blue;
}
.tweet.\+featured {
  color: yellow;
}
.tweet.\+featured .tweet--avatar {
  border: 1px solid yellow;
}
.tweet--avatar {
  border-radius: 0;
}
.tweet--avatar.\+circular {
  border-radius: 50%;
}
```

```html
<div class="+featured tweet">
  <div class="+circular tweet--avatar">...</div>
</div>
```

### `is(args...)`

When a component, container, or element `is` in a particular state, it receives new styles.

```stylus
component(tweet) {
  is(hovered, focused) {
    transform: scale(1.1);
  }
  has(avatar) {
    is(visited) {
      opacity: 0.8;
    }
  }
}
container(testimonials) {
  is(hovered) {
    background: purple;
  }
}
```

```css
.tweet:hover,
.tweet:focus {
  transform: scale(1.1);
}
.tweet--avatar:visited {
  opacity: 0.8;
}
.\@testimonials:hover {
  background: purple;
}
```

### `container(args...)`

Creates a parent. This is useful if you follow the OOCSS principle of separating content from container.

```stylus
container(about-us) {
  background: blue;
}
```

```css
.\@about-us {
  background: blue;
}
```

```html
<div class="@about-us">...</div>
```

### `inside(args...)`

If a component is `inside` a container, you might choose to override specific properties.

```stylus
component(tweet) {
  background: white;
  inside(testimonials) {
    background: transparent;
    color: #fff;
  }
}
```

```css
.tweet {
  background: white;
}
#system .\@testimonials .tweet {
  background: transparent;
  color: #fff;
}
```

```html
<div class="@testimonials">
  <div class="tweet"></div>
</div>
```

### `util(args...)`

Creates a utility. These are generic and pretty specific - they will override everything with the exception of a component that is `inside` a container.

```stylus
util(mt-10) {
  margin-top: 10px;
}
```

```css
.\~mt-10 {
  margin-top: 10px;
}
```

```html
<div class="tweet ~mt-10">...</div>
```

## Mixins API

All mixins follow the same method signature.

>**Please Note** that these mixins will only compile down to the syntax that is transformed by `system` through PostCSS, they are not to be used as standalone alternatives.

### Stylus

```stylus
+component(tweet, box)
  color: blue
```

### SCSS

```scss
@include component(tweet, box) {
  color: blue;
}
```

### SASS

```sass
+component(tweet, box)
  color: blue
```

### LESS

```less
.component('tweet, box', {
  color: blue;
});
```
