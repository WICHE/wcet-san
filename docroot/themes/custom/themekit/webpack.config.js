const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const yaml = require('js-yaml');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const FixStyleOnlyEntriesPlugin = require('webpack-fix-style-only-entries');

const entryPoints = {
  polyfill: 'babel-polyfill',
  themekit: './js/src/themekit.js',
  search_header: './js/src/search-header/search-header.jsx', // React component
  search_main: './js/src/search-main/search-main.jsx', // React component
  style: './sass/style.scss',
  wysiwyg: './sass/wysiwyg.scss',
};

const compiledEntries = {};

for (const prop in entryPoints) {
  compiledEntries[prop] = entryPoints[prop];
}

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  let vmName = '';

  if (isDev) {
    vmName = 'wcetsan.wiche.edu.docker.amazee.io';
  }

  return {
    context: __dirname,
    entry: compiledEntries,

    output: {
      path: `${__dirname}/dist`,
      filename: '[name].js',
    },

    resolve: {
      extensions: ['.js', '.vue', '.json', '.jsx'],
      alias: {
        vue$: 'vue/dist/vue.esm.js',
      },
    },

    externals: {
      jquery: 'jQuery',
    },

    devtool: isDev ? 'source-map' : false,

    plugins: [
      // The below will shim global jquery, the first two lines will replace $/jQuery
      // when require('jquery') is called. The third line, which we probably will always
      // need with Drupal, then uses the window.jQuery instead of the module jquery when
      // require('jquery') is called
      new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery',
        'window.jQuery': 'jquery',
      }),

      new BrowserSyncPlugin({
        host: 'localhost',
        port: 3000,
        proxy: vmName,
      },
      {
        injectCss: true,
      }),

      new FixStyleOnlyEntriesPlugin(),
      new MiniCssExtractPlugin({ filename: '[name].css' }),
    ],
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            name: 'commons',
            chunks: 'initial',
            // If you add more entryPoints, set minChunks to 2
            minChunks: 2,
          },
        },
      },
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
        },
        // {
        //   enforce: 'pre',
        //   test: /\.js$/,
        //   exclude: /node_modules/,
        //   loader: 'eslint-loader',
        // },
        {
          test: /\.js$/,
          // must add exceptions to this exlude statement for
          // anything that needs to be transpiled by babel
          exclude: [/node_modules\/(?!foundation-sites)/],
          loader: 'babel-loader',
        },
        {
          test: /\.jsx?$/,
          exclude: [/node_modules\/(?!foundation-sites)/],
          loader: 'babel-loader',
        },
        {
          test: /\.(png|jpg|gif)$/,
          use: [{ loader: 'file-loader' }],
        },
        {
          test: /\.(woff2?|ttf|otf|eot|svg)$/,
          exclude: /node_modules/,
          loader: 'file-loader',
          options: {
            name: '[path][name].[ext]',
          },
        },
        {
          test: /\.(sa|sc|c)ss$/,
          use: [{
            loader: MiniCssExtractPlugin.loader,
          }, {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              sourceMap: isDev,
            },
          }, {
            loader: 'postcss-loader',
            options: {
              sourceMap: isDev,
            },
          }, {
            loader: 'sass-loader',
            options: {
              includePaths: [path.resolve(__dirname, './node_modules/foundation-sites/scss')],
              sourceMap: isDev,
            },
          }],
        },
      ],
    },
  };
};
