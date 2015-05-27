'use strict';

require('angular').module('bincalc.calc')
	.factory('settings', [
		function() {
			var list = [
				{
					id: 'byteAlign',
					label: 'Byte Align',
					title: 'Align inputs to bytes',
					type: 'boolean',
					value: false
				},
				{
					id: 'lowercase',
					label: 'Lowercase',
					title: 'Lowercase base conversions',
					type: 'boolean',
					value: false
				},
				{
					id: 'invisiblesSpace',
					label: 'Invisibles to Space',
					title: 'Converts new line characters to spaces',
					type: 'boolean',
					value: false
				}
			];
			//Create a map from the list.
			var map = {};
			var item;
			for (var i = list.length; i--;) {
				item = list[i];
				map[item.id] = item;
			}
			return {
				list: list,
				map: map
			};
		}
	]);
