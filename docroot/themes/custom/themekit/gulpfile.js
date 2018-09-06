"use strict";

/************************
 * SETUP
 ************************/

var gulp = require('gulp');
var sass = require('gulp-sass');
var cleanCss = require('gulp-clean-css');
var sourcemaps = require('gulp-sourcemaps');
var autoprefixer = require('gulp-autoprefixer');
var livereload = require('gulp-livereload');
var concat = require('gulp-concat');
var sassdoc = require('sassdoc');
var webpack = require('webpack-stream');
var plumber = require('gulp-plumber');

/************************
 * CONFIGURATION
 ************************/

var autoReload = true;

var paths = {
  npmDir: './node_modules'
};

var includePaths = [
  // Add paths to any sass @imports that you will use from node_modules here
  paths.npmDir + '/foundation-sites/scss',
  paths.npmDir + '/select2/src/scss'
];

var stylesSrc = [
  // add any component CSS here (ie - from npm packages)
  './sass/style.scss'
];

var sassdocSrc = [
  './sass/**/*.scss',
];

var webpackEntryPoints = [
  './js/src/theme.js'
];

/************************
 * TASKS
 ************************/

gulp.task('styles', function() {
  gulp.src(stylesSrc)
    .pipe(sourcemaps.init())
    .pipe(sass({
      includePaths: includePaths
    }))

    // Catch any SCSS errors and prevent them from crashing gulp
    .on('error', function (error) {
      console.error(error);
      this.emit('end');
    })
    .pipe(autoprefixer('last 2 versions', '> 1%', 'ie 11'))
    .pipe(sourcemaps.write())
    .pipe(concat('style.css'))
    .pipe(gulp.dest('./css/'))
    .pipe(livereload());
});

gulp.task('wysiwyg', function() {
  gulp.src('./sass/wysiwyg.scss')
    .pipe(sass({
      includePaths: includePaths
    }))

    // Catch any SCSS errors and prevent them from crashing gulp
    .on('error', function (error) {
      console.error(error);
      this.emit('end');
    })
    .pipe(autoprefixer('last 2 versions'))
    .pipe(concat('wysiwyg.css'))
    .pipe(cleanCss({
      // turn off minifyCss sourcemaps so they don't conflict with gulp-sourcemaps and includePaths
      sourceMap: false
    }))
    .pipe(gulp.dest('./css/'))
});

gulp.task('sassdoc', function () {
  var options = {
    groups: {
      configuration: 'Configuration',
      utility: 'Framework Utilities',
      frameworkComponents: 'Framework Components',
      foundationExtensions: 'Foundation Extensions',
      settings: 'Noteworthy Settings',
      'undefined': 'Ungrouped',
    },
    basePath: 'https://github.com/SassDoc/sassdoc',
  };

  return gulp.src(sassdocSrc)
    .pipe(sassdoc(options));
});


gulp.task('scripts', function() {
  gulp.src(webpackEntryPoints)
    .pipe(plumber())
    .pipe(webpack( require('./webpack.config.js') ))
    .pipe(gulp.dest('./js/dist/'))
    .pipe(livereload());
});

gulp.task('watch', function() {
  if (autoReload) {
    livereload.listen();
  }
  gulp.watch('./sass/**/*.scss', ['styles', 'wysiwyg']);
  gulp.watch('./js/src/**/*.js', ['scripts']);
});

gulp.task('js_watch', function() {
  if (autoReload) {
    livereload.listen();
  }
  gulp.watch('./js/src/**/*.js', ['scripts']);
});

gulp.task('default', ['styles', 'scripts', 'wysiwyg']);
