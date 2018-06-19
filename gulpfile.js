'use strict';

/**
 *      gulp build        - build for development
 *      gulp watch        - build and watch files for change
 *      gulp              - default task [watch]
 *      gulp build --dist - build for production
 *      gulp browser-sync - create http server for testing
 *      gulp data         - build json data from 'src/data/' directory
 */

var del                = require('del'),
    path               = require('path'),
    gulp               = require('gulp'),
    gutil              = require('gulp-util'),
    concat             = require('gulp-concat'),
    browserSync        = require('browser-sync').create(),
    historyApiFallback = require('connect-history-api-fallback'),
    uglify             = require('gulp-uglify'),
    sass               = require('gulp-sass'),
    sassGlob           = require('gulp-sass-glob'),
    postcss            = require('gulp-postcss'),
    assets             = require('postcss-assets'),
    autoprefixer       = require('autoprefixer'),
    cssnano            = require('cssnano'),
    file               = require('gulp-file'),
    sourcemaps         = require('gulp-sourcemaps'),
    notify             = require('gulp-notify'),
    notifier           = require('node-notifier'),
    extend             = require('gulp-extend'),
    jsonlint           = require('gulp-jsonlint'),
    minimist           = require('minimist'),
    gulpif             = require('gulp-if'),
    runSequence        = require('run-sequence'),
    eslint             = require('gulp-eslint'),
    webpack            = require('webpack'),
    jeditor            = require('gulp-json-editor'),
    webpackConfig      = require('./webpack.config.js'),

    // get configuration
    config           = require('./config.json'),
    rootFiles        = config.root,
    scssIncludePaths = config.scssIncludePaths,
    cssVendor        = config.cssVendor,

    // parse parameters
    argv = minimist(process.argv.slice(2), { boolean: true });

/**
 *
 *   Build config
 *
 */

var BUILD_DIR = 'website',
    AUTO_PREFIXER_RULES = ['last 2 versions'];

/**
 *
 *   Helper variables
 *
 */

var TASK_NOTIFICATION = false,
    LIVE_RELOAD = false;

/**
 *
 *   Webpack production/development mode
 *
 */

if (argv.dist) {
    webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin());
    webpackConfig.mode = 'production';
} else {
    webpackConfig.mode = 'development';
    webpackConfig.devtool = '#cheap-module-source-map';
}

/**
 *
 *  Server
 *
 */

gulp.task('browser-sync', function () {
    browserSync.init({
        server: {
            baseDir: './' + BUILD_DIR,
            middleware: [historyApiFallback()]
        }
    });
});

/**
 *
 *   Clean task
 *
 */

gulp.task('_clean', function () {
    return del([
        BUILD_DIR + '/css/*.*',
        BUILD_DIR + '/css/assets/*.*',
        BUILD_DIR + '/css/vendor/*.css',
        BUILD_DIR + '/css/vendor/*.map',
        BUILD_DIR + '/templates/**',
        BUILD_DIR + '/js/**'
    ], { force: true });
});

/**
 *
 *   Build tasks
 *
 */

// Build main css
gulp.task('_css-build', function () {
    return gulp.src('src/scss/**/*.scss')
        .pipe(sassGlob())
        .pipe(gulpif(!argv.dist, sourcemaps.init()))
        .pipe(sass({ includePaths: scssIncludePaths })
        .on('error', notify.onError('Error: <%= error.message %>')))
        .pipe(gulpif(!argv.dist, postcss([
            assets({ basePath: BUILD_DIR }),
            autoprefixer({ browsers: AUTO_PREFIXER_RULES })
        ])
        .on('error', notify.onError('Error: <%= error.message %>'))))
        .pipe(gulpif(argv.dist, postcss([
            assets({ basePath: BUILD_DIR }),
            autoprefixer({ browsers: AUTO_PREFIXER_RULES }),
            cssnano
        ])
        .on('error', notify.onError('Error: <%= error.message %>'))))
        .pipe(gulpif(!argv.dist, sourcemaps.write('./')))
        .pipe(gulp.dest(BUILD_DIR + '/css/'))
        .pipe(gulpif(LIVE_RELOAD, browserSync.stream()))
        .pipe(gulpif(TASK_NOTIFICATION, notify({ message: 'CSS build completed.', onLast: true })));
});

// Build vendor css
gulp.task('_css-vendor-build', function () {
    return gulp.src(cssVendor)
        .pipe(gulpif(!argv.dist, sourcemaps.init()))
        .pipe(concat('vendor.css'))
        .pipe(gulpif(!argv.dist, postcss([
            autoprefixer({ browsers: AUTO_PREFIXER_RULES })
        ])
        .on('error', notify.onError('Error: <%= error.message %>'))))
        .pipe(gulpif(argv.dist, postcss([
            autoprefixer({ browsers: AUTO_PREFIXER_RULES }),
            cssnano
        ])
        .on('error', notify.onError('Error: <%= error.message %>'))))
        .pipe(gulpif(!argv.dist, sourcemaps.write('./')))
        .pipe(gulp.dest(BUILD_DIR + '/css/vendor/'))
        .pipe(gulpif(LIVE_RELOAD, browserSync.stream()))
        .pipe(gulpif(TASK_NOTIFICATION, notify({ message: 'Vendor CSS build completed.', onLast: true })));
});

// Build js files
var createWebpackCb = function (cb) {
    var calledOnce = false;

    var webpackCb = function (err, stats) {
        if (err) {
            throw new gutil.PluginError('webpack', err);
        }

        gutil.log('[webpack]', stats.toString({ chunks: false, colors: true }));

        if (stats.hasErrors()) {
            if (!TASK_NOTIFICATION) {
                throw new gutil.PluginError('webpack', new Error('JavaScript build error.'));
            } else {
                notifier.notify({
                    title: 'Error running Gulp',
                    message: 'JavaScript build error.',
                    icon: path.join(__dirname, 'node_modules', 'gulp-notify', 'assets', 'gulp-error.png'),
                    sound: 'Frog'
                });
                gutil.log(
                    gutil.colors.cyan('gulp-notify:'),
                    gutil.colors.blue('[Error running Gulp]'),
                    gutil.colors.green('JavaScript build error.')
                );
                gutil.log(
                    gutil.colors.white('Finished'),
                    gutil.colors.cyan('\'_js-watch\''),
                    gutil.colors.white('after'),
                    gutil.colors.magenta(stats.toJson().time + ' ms')
                );
            }
        } else {
            if (TASK_NOTIFICATION) {
                notifier.notify({
                    title: 'Gulp notification',
                    message: 'JavaScript build completed.',
                    icon: path.join(__dirname, 'node_modules', 'gulp-notify', 'assets', 'gulp.png')
                });
                gutil.log(
                    gutil.colors.cyan('gulp-notify:'),
                    gutil.colors.blue('[Gulp notification]'),
                    gutil.colors.green('JavaScript build completed.')
                );
                gutil.log(
                    gutil.colors.white('Finished'),
                    gutil.colors.cyan('\'_js-watch\''),
                    gutil.colors.white('after'),
                    gutil.colors.magenta(stats.toJson().time + ' ms')
                );
            }

            if (LIVE_RELOAD) {
                browserSync.reload();
            }
        }

        if (!calledOnce) {
            calledOnce = true;
            cb();
        }
    };

    return function (err, stats) {
        runSequence('_js-lint', function () {
            webpackCb(err, stats);
        });
    };
};

var compiler = webpack(webpackConfig);

gulp.task('_js-build', function (cb) {
    compiler.run(createWebpackCb(cb));
});

gulp.task('_js-watch', function (cb) {
    compiler.watch({}, createWebpackCb(cb));
});

// Copy templates
gulp.task('_templates-build', function () {
    return gulp.src('src/templates/**/*.html')
        .pipe(gulp.dest(BUILD_DIR + '/templates/'))
        .pipe(gulpif(LIVE_RELOAD, browserSync.stream()))
        .pipe(gulpif(TASK_NOTIFICATION, notify({ message: 'Template build completed.', onLast: true })));
});

// Copy root files
gulp.task('_root-files-build', function () {
    return gulp.src(rootFiles)
        .pipe(gulp.dest(BUILD_DIR + '/'))
        .pipe(gulpif(LIVE_RELOAD, browserSync.stream()))
        .pipe(gulpif(TASK_NOTIFICATION, notify({ message: 'Root files build completed.', onLast: true })));
});

// Build data
gulp.task('_data-build', function () {
    return gulp.src('src/data/**/*.json')
        .pipe(jsonlint())
        .pipe(jsonlint.reporter())
        .pipe(jsonlint.failOnError())
        .on('error', notify.onError('JSON data build error.'))
        .pipe(extend('data.json'))
        .pipe(gulp.dest(BUILD_DIR + '/data/'))
        .pipe(gulpif(LIVE_RELOAD, browserSync.stream()))
        .pipe(gulpif(TASK_NOTIFICATION, notify({ message: 'Data build completed.', onLast: true })));
});

gulp.task('data', ['_data-build']);

/**
 *
 *   ESLint task
 *
 */

gulp.task('_js-lint', function () {
    return gulp.src(['src/js/**/*.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.results(function (results) {
            if (results.errorCount === 0 && results.warningCount === 0) {
                return;
            }

            notifier.notify({
                title: 'Error running Gulp',
                message: 'JavaScript ESLint error.',
                icon: path.join(__dirname, 'node_modules', 'gulp-notify', 'assets', 'gulp-error.png'),
                sound: 'Frog'
            });
        }));
});

/**
 *
 *   Main build task
 *
 */

gulp.task('_build', ['_css-build', '_css-vendor-build', '_templates-build',
'_root-files-build', '_data-build'], function () {
    notifier.notify({
        title: 'Gulp notification',
        message: 'Build completed.',
        icon: path.join(__dirname, 'node_modules', 'gulp-notify', 'assets', 'gulp.png')
    });
});

gulp.task('build', function (cb) {
    runSequence('_clean', '_js-build', '_build', cb);
});

/**
 *
 *   Watch task
 *
 */

gulp.task('_watch', function () {
    gulp.watch('src/scss/**/*.scss', ['_css-build']);

    gulp.watch('src/templates/**/*.html', ['_templates-build']);

    gulp.watch(rootFiles, ['_root-files-build']);

    gulp.watch('src/data/**/*.json', ['_data-build']);
});

gulp.task('watch', function (cb) {
    runSequence('_clean', '_js-watch', '_build', '_watch', 'browser-sync', function () {
        TASK_NOTIFICATION = true;
        LIVE_RELOAD = true;

        cb();
    });
});

/**
 *
 *   Set DEFAULT task
 *
 */

gulp.task('default', ['watch']);
