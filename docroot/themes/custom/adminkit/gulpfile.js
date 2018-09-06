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
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var sassdoc = require('sassdoc');
var source = require('vinyl-source-stream');
var babel = require('gulp-babel');

/************************
 * CONFIGURATION
 ************************/

var autoReload = true;

var paths = {
  bowerDir: './bower_components'
};

var includePaths = [
  // Add paths to any sass @imports that you will use from bower_components here
  // Adding paths.bowerDir will allow you to target any bower package folder as an include path
  // for generically named assets
  paths.bowerDir
];

var stylesSrc = [
  // add bower_components CSS here
  paths.bowerDir + '/dragula.js/dist/dragula.css',
  './sass/style.scss'
];

// TODO: Think about adding sassdocs to admin theme in the future if necessary
// var sassdocSrc = [
//   './sass/base/*.scss',
//   './sass/layout/*.scss',
//   './sass/components/*.scss'
// ];

var scriptsSrc = [
  // add bower_component scripts here
  paths.bowerDir + '/svg-injector/svg-injector.js',
  paths.bowerDir + '/dom-autoscroller/dist/dom-autoscroller.js',
  paths.bowerDir + '/dragula.js/dist/dragula.js',
  './js/src/*.js'
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
    .pipe(gulp.dest('./css/src/'))
    .pipe(livereload())
    .pipe(cleanCss({
      compatibility: 'ie11'
    }))
    .pipe(gulp.dest('./css/dist/'))
    .pipe(livereload());
});

// gulp.task('sassdoc', function () {
//   return gulp.src(sassdocSrc)
//     .pipe(sassdoc());
// });

gulp.task('scripts', function() {
  gulp.src(scriptsSrc)
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(concat('adminkit.js'))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./js/dist/'))
    .pipe(livereload());
});

gulp.task('watch', function() {
  if (autoReload) {
    livereload.listen();
  }
  gulp.watch('./sass/**/*.scss', ['styles']);
  gulp.watch('./js/src/*.js', ['scripts']);
});

gulp.task('default', ['styles', 'scripts']);
