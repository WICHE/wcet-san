# ThemeKit
A starter Drupal subtheme reliant on the Drupal core Classy theme.
 
## Setup 

### Recommended

The easiest way to get up and running with themekit is to use [starterkit](https://github.com/elevatedthird/starterkit)
which will use this as it's starter theme.


Ensure you're in the themekit directory and run...

```
npm install
```

That's it, you now have all of the node modules required to start working.

If you would like to use livereload you will need to install the plugin for your browser [here](http://livereload.com/extensions/) and enable it.

## Gulp Tasks

### gulp styles

```
gulp styles
```

Compile all sass files to css. This will output two files.

1. css/src/style.css - the unminified css output.
1. css/dist/style.css - the minified css output.

Which file gets used can be determined by setting the global `$conf['minify_css']` in your settings.php to `0` or `1`.

### gulp scripts

```
gulp scripts
```

Compile all JavaScript files in js/src to a minified file in js/dist.

You can specify which if the site should use the minified or unminified version by setting the global `$conf['minify_js']`
in your settings.php to `0` or `1`.

### gulp default

```
gulp default
```
or...
```
gulp
```

Compiles all JavaScript and CSS. This essentially just calls `gulp styles` and `gulp scripts`.

### gulp watch

```
gulp watch
```

Watches for any JavaScript or sass changes and compiles them to css and js. this is similar to `gulp default` but with a
file watcher. 


## Bower
Bower is used to manage packages for the web. More information can be found [here](http://bower.io/). 

### setup
Bower requires node and npm. You will need to install it just once, globally.

```
npm install -g bower
```
### manage packages 
A bower project will already be initialized in themekit. Syntax is very similar to npm. To add a package...

```
bower install PACKAGENAME --save
```
The `--save` tag adds the package as a dependency to the `bower.json` file. You should generally always include it.

If you want to remove a package from your project because it sucks and you are no longer using it...

```
bower uninstall PACKAGENAME --save
```
This will remove all the files the package added AND remove the dependency in the `bower.json` file.

Bower projects can also have dependencies, so installing a package may include others. Uninstalling a package will remove all of its dependencies as well.

```
bower update <PACKAGENAME>
```
Upade all (or single) package to most recent version as defined in the `bower.json` file for that package.

Most commonly used packages will be compatible with bower. Search for packages [here](http://bower.io/search/).

### add to gulp workflow
Now add the assets to your gulp workflow.

Add the path to any `css` files in the `stylesSrc` array in the config section of `gulpfile.js`.

Any `js` files go in the `scriptsSrc`array in the config section of `gulpfile.js`.

Any `scss` assets that you will be importing into your theme (ie - libraries, susy, foundation) should have their path added to the `includePaths` array in the config section of `gulpfile.js`. This adds that path so you can simply `@include ASSET` in your style.scss file.

## Foundation
If you want to use Foundation you can install it with bower

```
bower install foundation --save
```
Add `paths.bowerDir + '/foundation/scss'` to the `includePaths` array in `gulpfile.js`.

Copy `./bower_components/foundation/scss/foundation/_settings.scss` to `./sass/base/_settings.scss`.

Create a file `./sass/base/_app.scss` and use [this](https://github.com/zurb/foundation-compass-template/blob/master/scss/app.scss) as a template. This partial contains the settings import and all of the foundation components imports. You can include all or include only what you like.

In your style.scss file add `@import "base/app";` after the `base` and `normalize` imports.

Add any of the scripts you want to include to the `scriptsSrc` array in `gulpfile.js` config.

Lastly, if you are using any javascript components, you must initialize foundation on DOM ready.

```
$(document).foundation();
```

## Susy or other libraries
As noted above, the import path must be included.
For example:

```
bower install susy --save
```
Add the `paths.bowerDir + '/susy/sass'` to `importPaths`.

In your theme scss, `@import "susy";` and you're good to go.

## Legacy Breakpoints
Foundation 6 has a great system for breakpoints which allows you to define them in sass and use them in javascript. The downside to Foundation in general is that there is no support for legacy browsers like IE8. [ResponseKit](https://github.com/tandroid1/ResponseKit) is a library that was created to provide very similar breakpoint functionality but with support for no-query fallbacks. 

You can install ResponseKit in a similar manner to Foundation:

- Run `bower install --save https://github.com/tandroid1/ResponseKit.git`
- Add `paths.bowerDir + '/foundation/scss'` to the `includePaths` array in `gulpfile.js`.
- Add `paths.bowerDir + '/ResponseKit/js/responseKit.js'` to the `scriptsSrc` array in `gulpfile.js`.
- In your `style.scss` add `@import "breakpoints"` at the top of your imports.

Additionally, you'll need to remove the `bp` mixin in `_mixins.scss` and the `bp` function in `_functions.scss` since they will conflict with ResponseKit.