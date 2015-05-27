'use strict';

var BigNumber = require('bignumber.js');

require('angular').module('bincalc.calc')
	.factory('fields', [
		'datatype',
		'dataendian',
		'settings',
		function(datatype, dataendian, settings) {
			//Settings objects.
			var settingsMap = settings.map;
			var settingByteAlign = settingsMap.byteAlign;
			var settingInvisiblesSpace = settingsMap.invisiblesSpace;
			var settingLowercase = settingsMap.lowercase;
			
			//Useful regexs.
			var rCharNG = /[^\x00-\xff]/g;
			var rDigit = /\d/;
			var rWhite = /\s/;
			var rWhiteNPG = /\S+/g;
			var rSign = /[\-\+]/;
			var rHex = /[\da-f]/i;
			var rHexNG = /[^\da-f]/ig;
			var rBin = /[01]/;
			var rBinNG = /[^01]/g;
			var rChunk8 = /.{1,8}/g;
			var rNonprintingG = /[\r\n\x00]/g;
			var rInvisiblesG = /[\x00-\x1f\x7f-\x9f\xad]/g;
			var rLeading0G = /^0+/;
			var r1g = /1/g;
			var r0g = /0/g;
			var rxg = /x/g;
			
			/**
			 * Flip all the bits in a bit string.
			 * 
			 * @param {string} str a string of bits.
			 * 
			 * @return {string} Flipped string.
			 */
			function bitFlip(str) {
				return str
					.replace(r1g, 'x')
					.replace(r0g, '1')
					.replace(rxg, '0');
			}
			
			/**
			 * Fill a string to the specified modulus with the specified string.
			 * 
			 * @param  {string}  str   The string to fill.
			 * @param  {string}  fill  The character to fill with.
			 * @param  {integer} mod   The modulus to fill up to.
			 * @param  {boolean} front Fill front or back.
			 * 
			 * @return {string} The filled string.
			 */
			function charFill(str, fill, mod, front) {
				var len = (str.length % mod);
				if (len) {
					var pad = (new Array(mod - len + 1)).join(fill);
					str = front ? (pad + str) : (str + pad);
				}
				return str;
			}
			
			/**
			 * Split a string every X number of character.
			 * 
			 * @param  {string} str The string to split.
			 * @param  {number} len The number characters to split on.
			 * 
			 * @return {Array} The split string.
			 */
			function splitEvery(str, len) {
				return str.match(splitEveryCache[len] = splitEveryCache[len] || (
					new RegExp('.{1,'+len+'}', 'g')
				));
			}
			var splitEveryCache = [];
			
			/**
			 * Formatter for base data types, supporting clamped and fixed.
			 * 
			 * @param {string}  value     Unformatted value.
			 * @param {integer} index     The current insertion index.
			 * @param {boolean} backwards Go backwards over spaces.
			 *
			 * @return {Object} An object with the updated value and index.
			 */
			function formatBase(value, index, backwards) {
				//jshint validthis:true
				var s = '';
				var c;
				var i = -1;
				var l = value.length;
				var clamp = this.clamped;
				var fixed = this.fixed;
				var match = this.valid;
				var chars = 0;
				var digits = '';
				var digitBackLen = clamp ? (clamp + '').length - 1 : 0;
				var delim = settingByteAlign.value;
				while (++i < l) {
					if (match.test(c = value[i])) {
						//Check if fixed width, or clamped.
						if (fixed) {
							s += c;
							if (delim && (++chars % fixed) === 0) {
								//Add a space unless it is the last index.
								if (i < l -1) {
									s += ' ';
									//Seek past space if entered before the space.
									if (!backwards && i === index - 2) {
										++index;
									}
								}
								//Increment if before index.
								if (i < index && i !== index - 1) {
									++index;
								}
							}
						}
						else {
							//Prevent seek over backspace.
							if (backwards && i === index && digits.length >= digitBackLen) {
								s += (+digits > clamp ? clamp : digits) + ' ';
								digits = '';
							}
							digits += c;
						}
					}
					else if(digits && rWhite.test(c)) {
						s += (+digits > clamp ? clamp : digits) + ' ';
						digits = '';
					}
					else if (i < index) {
						--index;
					}
				}
				if (digits) {
					s += (+digits > clamp ? clamp : digits);
				}
				return {
					value: s,
					index: index
				};
			}
			
			/**
			 * Formatter for number data types.
			 * 
			 * @param {string}  value Unformatted value.
			 * @param {integer} index The current insertion index.
			 *
			 * @return {Object} An object with the updated value and index.
			 */
			function formatNumber(value, index) {
				//jshint validthis:true
				var s = '';
				var c;
				var i = -1;
				var l = value.length;
				var dec = this.decimal;
				var sign = this.signed;
				while (++i < l) {
					//Allow digits, maybe leading sign, and maybe a decimal point.
					if (
						(rDigit.test(c = value[i])) ||
						(sign && !s && rSign.test(c)) ||
						(dec && c === '.' && !(dec = false))
					) {
						s += c;
					}
					else if (i < index) {
						--index;
					}
				}
				return {
					value: s,
					index: index
				};
			}
			
			/**
			 * Formatter that strips invalid characters.
			 * 
			 * @param {string}  value Unformatted value.
			 * @param {integer} index The current insertion index.
			 *
			 * @return {Object} An object with the updated value and index.
			 */
			function formatRaw(value, index) {
				//jshint validthis:true
				var strip = this.strip;
				//Split around the cursor, and strip.
				var bef = value.substr(0, index).replace(strip, '');
				var aft = value.substr(index).replace(strip, '');
				//Set the cursor to the end of the first part.
				return {
					value: bef + aft,
					index: bef.length
				};
			}
			
			/**
			 * Convert from base data types.
			 * 
			 * @param {string} value Formatted value.
			 *
			 * @return {Array} An array of decimal byte values.
			 */
			function fromBase(value) {
				//jshint validthis:true
				var r = [];
				var base = this.base;
				var strip = this.strip;
				var fixed = this.fixed;
				//Strip the chunk data.
				var chunks = (strip ? value.replace(strip, '') : value);
				//Split the chunks, either by fixed width or on white space.
				if (fixed) {
					//Fill before split if not byte aligned.
					if (!settingByteAlign.value) {
						//Trim the leading zeros keeping at least one.
						if (chunks) {
							chunks = chunks.replace(rLeading0G, '') || '0';
						}
						chunks = charFill(chunks, '0', fixed, true);
					}
					chunks = splitEvery(chunks, fixed);
				}
				else {
					chunks = chunks.match(rWhiteNPG);
				}
				if (chunks) {
					for (var i = chunks.length; i--;) {
						r[i] = parseInt(chunks[i], base);
					}
				}
				return r;
			}
			
			/**
			 * Convert from number data types.
			 * 
			 * @param {string} value Formatted value.
			 *
			 * @return {Array} An array of decimal byte values.
			 */
			function fromNumber(value) {
				//jshint validthis:true
				var r = [];
				if (value) {
					var i;
					var signed = this.signed;
					var nagative = false;
					var chunks = value;
					//If signed, save sign and strip it off.
					if (signed) {
						nagative = chunks[0] === '-';
						chunks = chunks.replace(rSign, '');
					}
					if (chunks) {
						//BigNumber is big-endian.
						chunks = new BigNumber(chunks);
						//If signed and negative, subtract one.
						if (signed && nagative) {
							chunks = chunks.minus(1);
						}
						//Generate bits.
						chunks = chunks.toString(2);
						//If signed, add the signing bit.
						var fill = '0';
						if (signed) {
							//If negative, flip all the bit.
							if (nagative) {
								fill = '1';
								chunks = bitFlip(chunks);
							}
							chunks = fill + chunks;
						}
						//Fill with the correct filler character.
						chunks = charFill(chunks, fill, 8, true);
						//Chunk and parse it.
						if ((chunks = chunks.match(rChunk8))) {
							//Reverse if little endian.
							if (this.endian === dataendian.LITTLE) {
								chunks.reverse();
							}
							for (i = chunks.length; i--;) {
								r[i] = parseInt(chunks[i], 2);
							}
						}
					}
				}
				return r;
			}
			
			/**
			 * Convert from raw data types.
			 * 
			 * @param {string} value Formatted value.
			 *
			 * @return {Array} An array of decimal byte values.
			 */
			function fromRaw(value) {
				//jshint validthis:true
				var r = [];
				for (var i = value.length; i--;) {
					r[i] = value.charCodeAt(i);
				}
				return r;
			}
			
			/**
			 * Convert to base data types.
			 * 
			 * @param {Array} An array of decimal byte values.
			 *
			 * @return {string} Formatted data.
			 */
			function toBase(value) {
				//jshint validthis:true
				var r;
				var fixed = this.fixed;
				var base = this.base;
				var delim = settingByteAlign.value;
				//Skip conversion if the same base and not fixed width.
				if (base === 10 && !fixed) {
					r = value;
				}
				else {
					r = [];
					for (var i = value.length; i--;) {
						var entry = value[i].toString(base);
						//If fixed width, then fill it, unless first one an is delimited.
						if (fixed) {
							entry = charFill(entry, '0', fixed, true);
						}
						r[i] = entry;
					}
				}
				//Join entries, space delimited if required.
				if (!fixed || delim) {
					r = r.join(' ');
				}
				else {
					r = r.join('');
					//If fixed and not delimited, trim leading zeros, keeping at least 1.
					if (!delim && r) {
						r = r.replace(rLeading0G, '') || '0';
					}
				}
				return settingLowercase.value ? r.toLowerCase() : r.toUpperCase();
			}
			
			/**
			 * Convert to number data types.
			 * 
			 * @param {Array} An array of decimal byte values.
			 *
			 * @return {string} Formatted data.
			 */
			function toNumber(value) {
				//jshint validthis:true
				var r = '';
				var chunks = [];
				var signed = this.signed;
				var nagative = false;
				for (var i = value.length; i--;) {
					chunks[i] = charFill(value[i].toString(2), '0', 8, true);
				}
				//Reverse if little endian.
				if (this.endian === dataendian.LITTLE) {
					chunks.reverse();
				}
				//Join chunks.
				if ((chunks = chunks.join(''))) {
					//If signed and negative, flip all the bits.
					if ((nagative = signed && chunks[0] === '1')) {
						chunks = bitFlip(chunks);
					}
					r = new BigNumber(chunks, 2);
					//Increment by one if signed negative.
					if (nagative) {
						r = r.plus(1);
					}
					//Add the negaitve sign if necesssary and make a string.
					r = (nagative ? '-' : '') + r.toString(10);
				}
				return r;
			}
			
			/**
			 * Convert to raw data types.
			 * 
			 * @param {Array} An array of decimal byte values.
			 *
			 * @return {string} Formatted data.
			 */
			function toRaw(value) {
				//jshint validthis:true
				var r = String.fromCharCode.apply(String, value).replace(rNonprintingG, ' ');
				return settingInvisiblesSpace.value ? r.replace(rInvisiblesG, ' ') : r;
			}
			
			//List of supported formats.
			var list = [
				//TODO: Support for floating point will need some options.
				/*{
					id:      'float_le',
					label:   '<0f',
					type:    datatype.FLOAT,
					endian:  dataendian.LITTLE,
					signed:  true,
					decimal: true,
					format:  formatNumber,
					from:    null,
					to:      null
				},
				{
					id:      'float_be',
					label:   '>0f',
					type:    datatype.FLOAT,
					endian:  dataendian.BIG,
					signed:  true,
					decimal: true,
					format:  formatNumber,
					from:    null,
					to:      null
				},*/
				{
					id:      'sint_le',
					label:   '<0s',
					title:   'Signed Integer, Little-Endian',
					type:    datatype.INT,
					endian:  dataendian.LITTLE,
					signed:  true,
					decimal: false,
					format:  formatNumber,
					from:    fromNumber,
					to:      toNumber
				},
				{
					id:      'sint_be',
					label:   '>0s',
					title:   'Signed Integer, Big-Endian',
					type:    datatype.INT,
					endian:  dataendian.BIG,
					signed:  true,
					decimal: false,
					format:  formatNumber,
					from:    fromNumber,
					to:      toNumber
				},
				{
					id:      'uint_le',
					label:   '<0u',
					title:   'Unsigned Integer, Little-Endian',
					type:    datatype.INT,
					endian:  dataendian.LITTLE,
					signed:  false,
					decimal: false,
					format:  formatNumber,
					from:    fromNumber,
					to:      toNumber
				},
				{
					id:      'uint_be',
					label:   '>0u',
					title:   'Unsigned Integer, Big-Endian',
					type:    datatype.INT,
					endian:  dataendian.BIG,
					signed:  false,
					decimal: false,
					format:  formatNumber,
					from:    fromNumber,
					to:      toNumber
				},
				{
					id:      'ascii',
					label:   '0a',
					title:   'ASCII, Extended',
					type:    datatype.ASCII,
					fixed:   1,
					strip:   rCharNG,
					format:  formatRaw,
					from:    fromRaw,
					to:      toRaw
				},
				{
					id:      'octal',
					label:   '0o',
					title:   'Octal',
					type:    datatype.OCTAL,
					base:    8,
					clamped: 377,
					valid:   rDigit,
					format:  formatBase,
					from:    fromBase,
					to:      toBase
				},
				{
					id:      'hex',
					label:   '0x',
					title:   'Hexadecimal',
					type:    datatype.HEX,
					base:    16,
					fixed:   2,
					valid:   rHex,
					strip:   rHexNG,
					format:  formatBase,
					from:    fromBase,
					to:      toBase
				},
				{
					id:      'dec',
					label:   '0d',
					title:   'Decimal',
					type:    datatype.DEC,
					base:    10,
					clamped: 255,
					valid:   rDigit,
					format:  formatBase,
					from:    fromBase,
					to:      toBase
				},
				{
					id:      'bin',
					label:   '0b',
					title:   'Binary',
					type:    datatype.BIN,
					base:    2,
					fixed:   8,
					valid:   rBin,
					strip:   rBinNG,
					format:  formatBase,
					from:    fromBase,
					to:      toBase
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
				map: map,
				common: null
			};
		}
	]);
