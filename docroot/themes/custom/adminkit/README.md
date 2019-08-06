# Adminkit
A Drupal admin subtheme based on Adminimal.
 
## Setup 

### NVM
NVM is used to manage the version of Node your theme tools are using. If you don't already have it installed, view the [Github page](https://github.com/nvm-sh/nvm) for install instructions.

Any directory that is being managed by NVM, contains a `.nvmrc` file that specifies the version of Node the project in the current directory should be using.

To switch to the required version of of Node, run the following in the theme directory:
```
nvm use
```
If the required version of Node is not installed on your system, NVM will prompt you to install it using `nvm install`.

### NPM
Now that you're using the correct version of node you can install the required packages using NPM.

Ensure you're in the themekit directory and run...
```
npm install
```
This will install all required node modules to the `node_modules` directory, which should never be committed. Required packages are specified in the `packages.json` file and locked to a specific version in `package-lock.json`.

If a package managed by NPM needs to be updated, increment it's version in `package.json` and run `npm update [package name]`.

**Note: If you would like to use livereload you will need to install the plugin for your browser [here](http://livereload.com/extensions/) and enable it.**

## Gulp Tasks
Gulp is a task runner installed and managed by NPM. It is used to run tasks like minification and compilation of Sass and JS.

Below you can find an overview of the Gulp tasks available for this project. You can add, edit and remove them in `gulpfile.js`.

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
