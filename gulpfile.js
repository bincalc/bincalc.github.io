'use strict';

var gulp = require('gulp');
var gulpUtil = require('gulp-util');
var gulpData = require('gulp-data');
var gulpRename = require('gulp-rename');
var gulpWrapper = require('gulp-wrapper');
var jade = require('jade');
var gulpJade = require('gulp-jade');
var gulpLess = require('gulp-less');
var gulpSourcemaps = require('gulp-sourcemaps');
var gulpAutoprefixer = require('gulp-autoprefixer');
var gulpMinifyCSS = require('gulp-minify-css');
var webpack = require('webpack');
var gulpJshint = require('gulp-jshint');
var globby = require('globby');
var path = require('path');
var del = require('del');
var pkg = require('./package.json');

var webpackCache = {};
var fontsStyle = 'https://fonts.googleapis.com/css?family=Aldrich|Lato:400,700,300,300italic,400italic,700italic|Ubuntu+Mono';

var bannerComment = gulpUtil.template(
	'/*!\n' +
	' * <%= name %>\n' +
	' * @version <%= version %>\n' +
	' * @author <%= author %>\n' +
	' * @copyright <%= copyright %>\n' +
	' * @license <%= license %>\n' +
	' */',
	{
		name:      pkg.name,
		version:   pkg.version,
		author:    pkg.author,
		copyright: pkg.copyright,
		license:   pkg.license,
		file:      null
	}
);

function getJadeData(file, data) {
	var r = file.data || {};
	var templatePath = path.relative(__dirname + '/src/jade', file.path).replace(/\.jade$/, '');
	var templateName = path.basename(templatePath);
	r.template = {
		name: templateName,
		path: templatePath,
		nameSlug: templateName.replace(/\W/g, '-'),
		pathSlug: templatePath.replace(/\W/g, '-')
	};
	r.copyright = {
		text: pkg.copyright.replace(/\(c\)/gi, '\u00A9') + '. ' + pkg.license + '.',
		link: 'http://alexomara.com/'
	};
	r.domain = pkg.homepage.replace(/^[^\:]+\:\/\//, '');
	r.pkg = pkg;
	if (data) {
		for (var p in data) {
			if (data.hasOwnProperty(p)) {
				r[p] = data[p];
			}
		}
	}
	return r;
}

function webpackEntries(glob, callback) {
	var entries = {};
	globby(glob, function (err, paths) {
		paths.forEach(function(entry) {
			entries[path.basename(entry).replace(/.[^\.]+$/, '')] = entry;
		});
		callback(entries);
	});
}

function webpackCallback(callback) {
	return function(err, stats) {
		if (err) {
			throw new gulpUtil.PluginError('webpack', err);
		}
		gulpUtil.log('[webpack]', '' + stats);
		callback();
	};
}

function jshint() {
	return gulp.src('./src/js/**/*.js')
		.pipe(gulpJshint())
		.pipe(gulpJshint.reporter('default'));
}
gulp.task('jshint', jshint);

function webpackDev(callback) {
	webpackEntries(['./src/js/*.js'], function(entries) {
		webpack({
			cache: webpackCache.dev = webpackCache.dev || {},
			entry: entries,
			output: {
				filename: './js/[name].js',
				sourceMapFilename: '[file].map',
				chunkFilename: '[id].[name].js',
				sourcePrefix: '',
				pathinfo: true
			},
			devtool: '#source-map',
			plugins: [
				new webpack.BannerPlugin(bannerComment, {
					raw: true
				})
			]
		}, webpackCallback(callback));
	});
}
gulp.task('webpack:dev', webpackDev);
gulp.task('webpack:dev::clean', ['clean'], webpackDev);
function webpackDist(callback) {
	webpackEntries(['./src/js/*.js'], function(entries) {
		webpack({
			cache: webpackCache.dist = webpackCache.dist || {},
			entry: entries,
			output: {
				filename: './js/[name].min.js',
				sourceMapFilename: '[file].map',
				chunkFilename: '[id].[name].min.js',
				sourcePrefix: '',
				pathinfo: false
			},
			//devtool: '#source-map',
			plugins: [
				new webpack.optimize.UglifyJsPlugin({
					minimize: true,
					compress: true,
					mangle: true,
					output: {
						comments: false,
						beautify: false
					}
				}),
				new webpack.BannerPlugin(bannerComment, {
					raw: true
				})
			]
		}, webpackCallback(callback));
	});
}
gulp.task('webpack:dist', webpackDist);
gulp.task('webpack:dist::clean', ['clean'], webpackDist);

function lessDev() {
	return gulp.src('./src/less/*.less')
		.pipe(gulpWrapper({
			header: bannerComment
		}))
		.pipe(gulpSourcemaps.init())
		.pipe(gulpLess({
			paths: ['./node_modules']
		}))
		.pipe(gulpAutoprefixer({
		 	browsers: ['> 0%'],
		 	cascade: true
		}))
		.pipe(gulpSourcemaps.write('.', {
			sourcePathBase: 'src/less',
			sourceRoot: 'source:///'
		}))
		.pipe(gulp.dest('./css/'));
}
gulp.task('less:dev', lessDev);
gulp.task('less:dev::clean', ['clean'], lessDev);
function lessDist() {
	return gulp.src('./src/less/*.less')
		.pipe(gulpWrapper({
			header: bannerComment
		}))
		//.pipe(gulpSourcemaps.init())
		.pipe(gulpLess({
			paths: ['./node_modules']
		}))
		.pipe(gulpAutoprefixer({
			browsers: ['> 0%'],
			cascade: false
		}))
		.pipe(gulpMinifyCSS({
			advanced: true,
			aggressiveMerging: true,
			keepBreaks: false,
			keepSpecialComments: 1,
			roundingPrecision: -1,
			processImport: false
		}))
		.pipe(gulpRename(function(path) {
			path.basename += '.min';
		}))
		//.pipe(gulpSourcemaps.write('.', {
		//	sourcePathBase: 'src/less',
		//	sourceRoot: 'source:///'
		//}))
		.pipe(gulp.dest('./css/'));
}
gulp.task('less:dist', lessDist);
gulp.task('less:dist::clean', ['clean'], lessDist);

function jadeDev() {
	return gulp.src(['./src/jade/**/*.jade', '!**/*.inc.jade', '!**/*.tpl.jade'])
		.pipe(gulpData(function(file) {
			return getJadeData(file, {
				header: {
					styles: [
						{
							src: fontsStyle
						},
						{
							src: 'css/main.css'
						}
					],
					scripts: [
						{
							src: 'js/main.js',
							attrs: {
								async: true,
								'data-webpack-dir': 'js/'
							}
						}
					]
				}
			});
		}))
		.pipe(gulpRename(function(path) {
			path.basename += '.src';
		}))
		.pipe(gulpJade({
			jade: jade,
			pretty: '\t'
		}))
		.pipe(gulp.dest('./'));
}
gulp.task('jade:dev', jadeDev);
gulp.task('jade:dev::clean', ['clean'], jadeDev);
function jadeDist() {
	return gulp.src(['./src/jade/**/*.jade', '!**/*.inc.jade', '!**/*.tpl.jade'])
		.pipe(gulpData(function(file) {
			return getJadeData(file, {
				header: {
					styles: [
						{
							src: fontsStyle
						},
						{
							src: 'css/main.min.css?v=' + pkg.version
						}
					],
					scripts: [
						{
							src: 'js/main.min.js?v=' + pkg.version,
							attrs: {
								async: true,
								'data-webpack-dir': 'js/'
							}
						}
					]
				}
			});
		}))
		.pipe(gulpJade({
			jade: jade,
			pretty: false
		}))
		.pipe(gulp.dest('./'));
}
gulp.task('jade:dist', jadeDist);
gulp.task('jade:dist::clean', ['clean'], jadeDist);

gulp.task('clean', function(callback) {
	//Not super clever about finding the HTML templates, but fast.
	del([
		'./index{.src,}.html',
		'./404{.src,}.html',
		'./css/**/*.{css,map}',
		'./js/**/*.{js,map}'
	], callback);
});

gulp.task('watch:dev', function() {
	gulp.watch('./src/less/**/*.less', ['less:dev']);
	gulp.watch('./src/js/**/*.js'    , ['webpack:dev']);
	gulp.watch('./src/jade/**/*.jade', ['jade:dev']);
});
gulp.task('watch:dist', function() {
	gulp.watch('./src/less/**/*.less', ['less:dist']);
	gulp.watch('./src/js/**/*.js'    , ['webpack:dist']);
	gulp.watch('./src/jade/**/*.jade', ['jade:dist']);
});

gulp.task('dev', [
	'jshint',
	'webpack:dev::clean',
	'less:dev::clean',
	'jade:dev::clean'
]);
gulp.task('dev:watch', [
	'dev',
	'watch:dev'
]);

gulp.task('dist', [
	'jshint',
	'webpack:dist::clean',
	'less:dist::clean',
	'jade:dist::clean'
]);
gulp.task('dist:watch', [
	'dist',
	'watch:dist'
]);

gulp.task('default', [
	'dev',
	'dist'
]);
