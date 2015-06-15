/**
 * Redis dump main file.
 *
 * @author Dmitriy Yurchenko <feedback@evildev.ru>
 */

var Redis = require('redis'),
	async = require('async'),
	_ = require('underscore');

/**
 * Redis dump class.
 *
 * @param {Object} params init params.
 * @constructor
 */
var RedisDump = module.exports = function(params) {
	'use strict';

	var client;

	/**
	 * @return {String} version of library.
	 */
	this.getVersion = function() {
		return '0.2.1';
	};

	/**
	 * @return {Object} redis client.
	 */
	this.getClient = function() {
		return client || params.client;
	};

	/**
	 * @return {Object} initialize parameters.
	 */
	this.getConnectParams = function() {
		return params;
	};

	/**
	 * Connect to redis server if not set client during initialize.
	 *
	 * @return {Boolean} true if success connect.
	 */
	this.connect = function() {
		client = Redis.createClient(params.port, params.host, params);
		if (!_.isEmpty(params.password)) {
			client.auth(params.password);
		}

		return !client;
	};
};

/**
 * Read key callback by type.
 */
var GetForTypeCallback = function(key, data, callback) {
	'use strict';

	/**
	 * Read scores by values.
	 *
	 * @param {Array} values
	 * @param {Function} callback
	 */
	var ReadScores = function(values, callback) {
		var result = [];

		/**
		 * Get scores recursive.
		 */
		var GetRecursive = function() {
			if (!values.length) {
				callback(null, result);
				return;
			}

			var value = values.pop();

			this.getClient().zscore(key, value, function(err, score) {
				if (err) {
					callback(err);
					return;
				}

				result.push(score);
				GetRecursive();
			});
		}.bind(this);

		GetRecursive();
	}.bind(this);

	/**
	 * Read key.
	 *
	 * @param {String} key
	 * @param {String} type
	 * @param {Function} rkCallback
	 */
	var ReadKey = function(key, type, rkCallback) {
		var params = [ key ],
			command = {
				set: 'smembers',
				zset: 'zrange',
				list: 'lrange',
				hash: 'hgetall'
			}[ type ] || 'get';

		if (command.indexOf('range') !== -1) {
			params.push(0);
			params.push(-1);
		}

		params.push(function(err, values) {
			if (err) {
				rkCallback(err);
				return;
			}

			switch (type) {
				case 'zset':
					ReadScores(_.clone(values).reverse(), function(err, scores) {
						rkCallback(null, _.zip(scores, values));
					});
					break;

				default:
					rkCallback(null, values);
					break;
			}
		});

		this.getClient()[ command ].apply(this.getClient(), params);
	}.bind(this);


	switch (this.getExportParams().type) {
		//	Export as redis type.
		case 'redis':
			return function(err, type) {
				var type2PrintSetCommand = {
					string: 'SET',
					set: 'SADD',
					zset: 'ZADD',
					list: 'RPUSH',
					hash: 'HSET'
				};

				if (!data) {
					data = '';
				}

				ReadKey(key, type, function(err, value) {
					if (err) {
						callback(err);
						return;
					}

					var command = type2PrintSetCommand[ type ];

					key = key.trim();

					switch (type) {
						case 'set':
							_.each(value, function(item) {
								data += command + ' "' + key + '" "' + item + "\"\n";
							});
							break;

						case 'zset':
							_.each(value, function(item) {
								data += command + ' "' + key + '" ' + item[0] + ' "' + item[1] + "\"\n";
							});
							break;

						case 'hash':
							_.each(_.pairs(value), function(item) {
								data += command + ' "' + key + '" "' + item[0] + '" "' + item[1] + "\"\n";
							});
							break;

						default:
							data += command + ' "' + key + '" "' + value + "\"\n";
							break;
					}

					callback(null, data);
				});
			};

		//	Export as json type.
		case 'json':
			return function(err, type) {
				if (!data) {
					data = {};
				}

				ReadKey(key, type, function(err, value) {
					if (err) {
						callback(err);
						return;
					}

					switch (type) {
						case 'zset':
							var withoutScores = [];
							_.each(value, function(item) {
								withoutScores.push(item[1]);
							});
							value = withoutScores;
							break;
					}

					data[ key.trim() ] = value;

					callback(null, data);
				});
			};
	}
};

/**
 * Make redis dump.
 *
 * @param {Object} params
 */
RedisDump.prototype.export = function(params) {
	'use strict';

	/**
	 * @return {Object} export params
	 */
	this.getExportParams = function() {
		return params;
	};

	async.waterfall([
		/**
		 * Get keys.
		 *
		 * @param callback
		 */
		function(callback) {
			this.getClient().keys('*', callback);
		}.bind(this),

		/**
		 * Read keys.
		 *
		 * @param keys
		 * @param callback
		 */
		function(keys, callback) {
			var exportData;

			/**
			 * Read keys recursive.
			 */
			var ReadKeysRecursive = function(err, data) {
				if (err) {
					callback(err);
					return;
				}

				if (data) {
					exportData = data;
				}

				if (!keys.length) {
					callback(null, exportData);
					return;
				}

				var key = keys.pop();

				this.getClient().type(key, GetForTypeCallback.call(this, key, exportData, ReadKeysRecursive));
			}.bind(this);

			ReadKeysRecursive();
		}.bind(this)
	], function(err, data) {
		if (!_.isFunction(params.callback)) {
			params.callback = function() {};
		}

		params.callback(err, data);
	});
};

/**
 * Import redis data.
 *
 * @param {Object} params
 */
RedisDump.prototype.import = function(params) {
	'use strict';

	//	Import report.
	var report = {
		inserted: 0,
		errors: 0
	};

	/**
	 * @return {Object} export params
	 */
	this.getImportParams = function() {
		return params;
	};

	async.waterfall([
		/**
		 * Check.
		 */
		function(callback) {
			if (!params.type) {
				params.type = 'redis';
			}

			if (params.type !== 'redis') {
				callback('Import type "' + params.type + '" is not supported!');
				return;
			}

			callback();
		},

		/**
		 * Select DB if need.
		 */
		function(callback) {
			if (_.isNumber(params.db)) {
				this.getClient().select(params.db, callback);
			} else {
				callback(null, 'OK');
			}
		}.bind(this),

		/**
		 * Flush all if need.
		 */
		function(status, callback) {
			if (params.clear) {
				console.log('clear db');
				this.getClient().flushdb();
			}

			callback();
		}.bind(this),

		/**
		 * Import.
		 */
		function(callback) {
			var items = params.data.split(new RegExp('(SET|RPUSH|LPUSH|SADD|ZADD|HSET) ', 'g'));

			/**
			 * Recursive add.
			 */
			var AddRecursive = function() {
				if (items.length < 2) {
					callback();
					return;
				}

				/**
				 * Callback function.
				 */
				var Callback = function(err, status) {
					if (err) {
						callback(err);
						return;
					}

					if (status || status === 'OK') {
						report.inserted += _.isNumber(status) ? status : 1;
					} else {
						//	Hm...
						report.errors += 1;
					}

					AddRecursive();
				};

				var args = items.pop(),
					command = items.pop(),
					callArgs = [];

				switch (command) {
					case 'SET':
					case 'SADD':
						callArgs = args.match(new RegExp('"?(.+?)"?\\s+"?(.+?)"?(?:\\s|$)', 'i')).slice(1, 3);
						break;

					case 'RPUSH':
					case 'LPUSH':
						callArgs = args.match(new RegExp('"?(.+?)"?\\s+"?([0-9]+?)"?(?:\\s|$)', 'i')).slice(1, 3);
						break;

					case 'ZADD':
						callArgs = args.match(new RegExp('"?(.+?)"?\\s+"?([0-9]+?)"?\\s+"?(.+?)"?(\\s|$)', 'i')).slice(1, 4);
						break;

					case 'HSET':
						callArgs = args.match(new RegExp('"?(.+?)"?\\s+"?(.+?)"?\\s+"?(.+?)"?(\\s|$)', 'i')).slice(1, 4);
						break;

					default:
						console.error(command, args);
						callback('Error import data! Not supported type!');
						return;
				}

				callArgs.push(Callback);
				this.getClient()[ command ].apply(this.getClient(), callArgs);
			}.bind(this);

			AddRecursive();
		}.bind(this)
	], function(err) {
		if (!_.isFunction(params.callback)) {
			params.callback = function() {};
		}

		params.callback(err, report);
	});
};