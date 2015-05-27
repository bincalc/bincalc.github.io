'use strict';

var scripts = global.document.getElementsByTagName('script');
var webpackDir;
//Initialize Webpack.
for (var i = scripts.length; i--;) {
	if ((webpackDir = scripts[i].getAttribute('data-webpack-dir'))) {
		__webpack_public_path__ = webpackDir;//jshint ignore:line
		break;
	}
}

require('./calc');

require('angular').module('bincalc', [
	'bincalc.calc'
]);
