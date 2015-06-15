'use strict';

var CmdParser = require('../parser');

exports.completerTest = {
  "single word command": function (test) {
    var cmdparser = new CmdParser([
      "test"
    ]);
    cmdparser.completer("te", function (err, results) {
      test.equal(err, null);
      test.deepEqual(results, [
        ["test "],
        "te"
      ]);
      test.done();
    });
  },

  "single word command, multiple matches": function (test) {
    var cmdparser = new CmdParser([
      "test1",
      "test2"
    ]);
    cmdparser.completer("te", function (err, results) {
      test.equal(err, null);
      test.deepEqual(results, [
        ["test1 ", "test2 "],
        "te"
      ]);
      test.done();
    });
  },

  "single word command, no match": function (test) {
    var cmdparser = new CmdParser([
      "test"
    ]);
    cmdparser.completer("bad", function (err, results) {
      test.equal(err, null);
      test.equal(results, null);
      test.done();
    });
  },

  "one required parameter": function (test) {
    var cmdparser = new CmdParser([
      "test param1"
    ], {
      param1: function (partial, callback) {
        process.nextTick(function () {
          callback(null, [partial + "1", partial + "2", partial + "3"]);
        });
      }
    });
    cmdparser.completer("test val", function (err, results) {
      test.equal(err, null);
      test.deepEqual(results, [
        ["val1", "val2", "val3"],
        "val"
      ]);
      test.done();
    });
  },

  "literal": function (test) {
    var cmdparser = new CmdParser([
      "test [TEST]"
    ]);
    cmdparser.completer("test T", function (err, results) {
      test.equal(err, null);
      test.deepEqual(results, [
        ["TEST"],
        "T"
      ]);
      test.done();
    });
  }
};
