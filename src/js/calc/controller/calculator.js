'use strict';

require('angular').module('bincalc.calc')
	.controller('calculator', [
		'$scope',
		'fields',
		'settings',
		function($scope, fields, settings) {
			var fieldsList = fields.list;
			$scope.fields = fields;
			$scope.settings = settings;
			$scope.update = function(field) {
				var item;
				var fieldId;
				var data;
				//If a field is specified, update to that field.
				if (field) {
					fieldId = field.id;
					fields.common = field.from(field.value);
				}
				//If data has been entered, loop over updating all.
				if ((data = fields.common)) {
					//Loop over the other fields, to update them.
					for (var i = fieldsList.length; i--;) {
						//Update all, skipping the one that triggered it.
						if ((item = fieldsList[i]).id !== fieldId) {
							item.value = item.to(data);
						}
					}
				}
			};
		}
	]);
