var webpack = require("webpack");

var entryPoints = {
  themekit: "./js/src/theme.js",

  // You can define additional entry points for something like
  // a react app as shown below. Once this is defined, it will
  // create an output file named "myApp.js" which you can add to
  // the site using Drupal's libarary system.
  // "quick-quote": "./js/src/quick-quote/index.js"
};

var compiledEntries = {};

for (var prop in entryPoints) {
  compiledEntries[prop] = entryPoints[prop];
  // compiledEntries[prop + ".min"] = entryPoints[prop];
}

var config = {
  context: __dirname,
  entry: compiledEntries,

  output: {
    filename: "[name].js",
  },

  externals: {
    jquery: 'jQuery'
  },

  devtool: 'cheap-source-map',
  plugins: [
    // The below will shim global jquery, the first two lines will replace $/jQuery when require('jquery') is called
    // The third line, which we probably will always need with Drupal, then uses the window.jQuery instead of the
    // module jquery when require('jquery') is called
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
      "window.jQuery": "jquery"
    })
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        // must add exceptions to this exlude statement for anything that needs to be trasnpiled by babel
        exclude: /node_modules\/(?!foundation-sites)/,
        loader: 'babel-loader',
        query: {
          presets: ["env"]
        }
      }
    ]
  },

};

module.exports = config;
