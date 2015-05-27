'use strict';

require('angular').module('bincalc.calc')
	.directive('bincalcField', function() {
		return {
			restrict: 'A',
			require: 'ngModel',
			link: function(scope, element, attr, ctrl) {
				var field = scope.$eval(attr.bincalcField);
				//Track the input direction, for the alignment functions.
				var backspace = false;
				element.bind('keydown', function(e) {
					backspace = e.keyCode === 8;
				});
				var lastValue;
				ctrl.$parsers.push(function(viewValue) {
					//Skip re-format if the value has not changed or no format function.
					if (lastValue === viewValue || !field.format) {
						return viewValue;
					}
					//Format the value, pass the current insertion point.
					var el = element[0];
					var formatted = field.format(viewValue, el.selectionEnd, backspace);
					var formattedValue;
					var formattedIndex;
					//Check if formatting changed;
					if (1 && viewValue !== (formattedValue = formatted.value)) {
						//Update variables and render.
						lastValue = viewValue = formattedValue;
						ctrl.$setViewValue(viewValue);
						ctrl.$render();
						//Restore the insertion index.
						formattedIndex = formatted.index;
						el.setSelectionRange(formattedIndex, formattedIndex);
					}
					return viewValue;
				});
			}
		};
	});
