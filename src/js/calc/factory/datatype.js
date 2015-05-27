'use strict';

require('angular').module('bincalc.calc')
	.factory('datatype', [
		function() {
			return {
				'FLOAT': 'FLOAT',
				'INT': 'INT',
				'ASCII': 'ASCII',
				'OCTAL': 'OCTAL',
				'HEX': 'HEX',
				'DEC': 'DEC',
				'BIN': 'BIN'
			};
		}
	]);
