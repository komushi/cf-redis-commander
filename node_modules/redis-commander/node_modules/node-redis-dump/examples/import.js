/**
 * Redis import example.
 *
 * @author Dmitriy Yurchenko <feedback@evildev.ru>
 */

var REDIS_DUMP = 'SET articles:1:desc "DESC" ' +
	'SET articles:3:desc "DESC" ' +
	'SET articles:3:name "Postgres article!" ' +
	'SET articles:1:name "First tutorial for nodejs" ' +
	'SET articles:2:desc "DESC" ' +
	'ZADD rubrics:3:_:relations:articles 1378911643410 "1" ' +
	'ZADD rubrics:3:_:relations:articles 1378913150937 "2" ' +
	'SET articles:1:alias "nodejs_first_tutorial" ' +
	'SET rubrics:2:alias "debian" ' +
	'SET rubrics:1:name "PostgreSQL" ' +
	'SET users:_:attributes:login:evildev "1" ' +
	'SET articles:3:text "Postgres article!" ' +
	'SET articles:2:alias "nodejs_article_2" ' +
	'ZADD articles:_:lists:all 1378911643410 "1" ' +
	'ZADD articles:_:lists:all 1378913150937 "2" ' +
	'ZADD articles:_:lists:all 1378913165465 "3" ' +
	'SET articles:1:text "***" ' +
	'SET users:1:login "evildev" ' +
	'SET rubrics:2:name "Debian" ' +
	'SET articles:2:name "First tutorial for nodejs 2" ' +
	'SET articles:2:text "First tutorial for nodejs 2" ' +
	'SADD articles:1:_:relations:rubrics "3" ' +
	'SADD articles:2:_:relations:rubrics "3" ' +
	'SADD articles:3:_:relations:rubrics "1" ' +
	'SET articles:3:alias "postgres_article" ' +
	'ZADD rubrics:1:_:relations:articles 1378913165465 "3" ' +
	'SET rubrics:3:name "Node.js" ' +
	'SET users:1:password "123" ' +
	'SET rubrics:3:alias "nodejs" ' +
	'SET rubrics:1:alias "postgresql"' +
	'HSET "hashobj:1" "hashkey" "hashvalue"' +
	'HSET "hashobj:1" "key2" "val"';

var RedisDump = require('./../index.js'),
	dump = new RedisDump({
		host: 'localhost',
		port: 6379,
		password: ''

		//	Or if connection is exist
		//	client: YOUR_REDIS_CLIENT
	});

dump.connect();
dump.import({
	type: 'redis',
	db: 0,
	data: REDIS_DUMP,
	clear: true,
	callback: function(err, report) {
		'use strict';

		if (err) {
			console.log('Could\'t not import redis data!', err);
			return;
		}

		console.log('Report:', report);
	}
});