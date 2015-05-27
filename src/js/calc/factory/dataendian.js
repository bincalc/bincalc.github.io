'use strict';

require('angular').module('bincalc.calc')
	.factory('dataendian', [
		function() {
			return {
				'BIG': 'BIG',
				'LITTLE': 'LITTLE'
			};
		}
	]);
