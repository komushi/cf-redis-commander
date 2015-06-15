'use strict';

var async = require('async');

var COMPLETING_ERROR = 'completeing';

var CmdParser = module.exports = function (commands, completers) {
  this._commands = commands.map(parseCommand);
  this._completers = completers;
};

CmdParser.prototype.parse = function (str, callback) {
  var matches = [];
  async.forEach(this._commands, function (cmd, cb) {
    cmd.parse(str, function (err, r) {
      if (r) {
        matches.push(r);
      }
      cb();
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    if (matches.length === 0) {
      return callback();
    }
    if (matches.length === 1) {
      return callback(null, matches[0]);
    }
    return callback(new Error('Multiple matches [' + JSON.stringify(matches) + '] for string "' + str + '".'));
  });
};

CmdParser.prototype.completer = function (str, callback) {
  var self = this;
  var matches = [];
  async.forEach(this._commands, function (cmd, cb) {
    cmd.completer(str, self._completers, function (err, r) {
      if (r) {
        matches.push(r);
      }
      cb();
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    if (matches.length === 0) {
      return callback();
    }
    var bestPartial = matches[0].partial; // todo find a better way
    var results = [
      [],
      bestPartial
    ];
    matches.forEach(function (m) {
      if (m.partial.toLowerCase() === bestPartial.toLowerCase()) {
        if (m.value instanceof Array) {
          results[0] = results[0].concat(m.value);
        } else {
          results[0].push(m.value);
        }
      }
    });
    callback(null, results);
  });
};

function parseCommand(cmd) {
  var debug = false;

  var m = cmd.match(/^(.*?)\s(.*)/);
  var commandName;
  var parts = [];
  var paramName;
  var i;
  if (m) {
    commandName = m[1];
    parts.push({ op: 'commandName', name: commandName });
    var cmdParameters = m[2];
    for (i = 0; i < cmdParameters.length;) {
      if (cmdParameters[i] === '[') {
        i++;
        paramName = '';
        while (cmdParameters[i] !== ']') {
          paramName += cmdParameters[i++];
        }
        i++;

        var subParts = paramName.split(' ');
        var repeat = false;
        if (subParts[subParts.length - 1] === '...') {
          repeat = true;
          subParts.splice(subParts.length - 1);
        }

        subParts = subParts.map(function (name) {
          if (name.toUpperCase() === name) {
            return {
              op: 'literal',
              names: name.split('|')
            };
          }

          return {
            op: 'requiredParameter',
            name: name
          };
        });
        parts.push({
          repeat: repeat,
          op: 'optionalParameters',
          parts: subParts
        });
        continue;
      }

      if (isWhitespace(cmdParameters[i])) {
        i++;
        continue;
      }

      paramName = '';
      while (i < cmdParameters.length && !isWhitespace(cmdParameters[i])) {
        paramName += cmdParameters[i++];
      }
      if (paramName.toUpperCase() === paramName) {
        parts.push({
          op: 'literal',
          names: paramName.split('|')
        });
      } else {
        parts.push({
          op: 'requiredParameter',
          name: paramName
        });
      }
    }
  } else {
    commandName = cmd;
    parts.push({ op: 'commandName', name: commandName });
  }

  for (i = 0; i < parts.length; i++) {
    if (parts[i].op === 'optionalParameters' && parts[i].parts[0].op === 'literal') {
      var startOrPartIdx = i;
      var endOrPartIdx = i;
      while (endOrPartIdx < parts.length && parts[endOrPartIdx].op === 'optionalParameters' && parts[endOrPartIdx].parts[0].op === 'literal') {
        endOrPartIdx++;
      }
      if (startOrPartIdx !== endOrPartIdx - 1) {
        var orPart = {
          op: 'optionalParameterLiteralOr',
          parts: parts.slice(startOrPartIdx, endOrPartIdx)
        };
        parts.splice(startOrPartIdx, endOrPartIdx - startOrPartIdx, orPart);
        i = startOrPartIdx - 1;
      }
    }
  }

  function doParse(str, callback) {
    var state = {
      parsing: true,
      strIdx: 0,
      startStrIdx: 0,
      str: str,
      cmd: cmd,
      debug: debug,
      result: {
        name: null,
        params: {}
      }
    };
    parseAll(state, parts, callback);
  }

  function doCompleter(str, completers, callback) {
    var state = {
      completing: true,
      completers: completers,
      strIdx: 0,
      startStrIdx: 0,
      str: str,
      cmd: cmd,
      debug: debug,
      result: {
        name: null,
        params: {}
      }
    };
    parseAll(state, parts, function (err) {
      callback(err, state.completer);
    });
  }

  return {
    parse: doParse,
    completer: doCompleter
  };
}

function isWhitespace(ch) {
  return /\s/.test(ch)
}

function skipWhitespace(state) {
  var startStrIdx = state.strIdx;
  while (state.strIdx < state.str.length && isWhitespace(state.str[state.strIdx])) {
    state.strIdx++;
  }
  return state.strIdx !== startStrIdx;
}

function readNextWord(state) {
  var word = '';
  if (state.str[state.strIdx] === '"') {
    state.strIdx++;
    while (state.strIdx < state.str.length && state.str[state.strIdx] !== '"') {
      if (state.str[state.strIdx] === '\\') {
        state.strIdx++;
        word += state.str[state.strIdx++];
      } else {
        word += state.str[state.strIdx++];
      }
    }
    state.strIdx++;
  } else {
    while (state.strIdx < state.str.length && !isWhitespace(state.str[state.strIdx])) {
      word += state.str[state.strIdx++];
    }
  }
  return word;
}

function peekNextWord(state) {
  var saveStrIdx = state.strIdx;
  var word = readNextWord(state);
  state.strIdx = saveStrIdx;
  return word;
}

function isEndOfString(state) {
  return state.str.length === state.strIdx;
}

function parseAll(state, parts, callback) {
  if (state.debug) {
    console.log('parts', state.cmd, JSON.stringify(parts, null, '  '));
  }

  async.forEachSeries(parts, function (part, callback) {
    if (state.completer) {
      return callback();
    }

    if (part.op === 'commandName') {
      return parseCommandName(state, part, callback);
    }

    if (part.op === 'requiredParameter') {
      return parseRequiredParameter(state, part, callback);
    }

    if (part.op === 'optionalParameters') {
      return parseOptionalParameters(state, part, callback);
    }

    if (part.op === 'literal') {
      return parseLiteral(state, part, callback);
    }

    if (part.op === 'optionalParameterLiteralOr') {
      return parseOptionalParameterLiteralOr(state, part, callback);
    }

    return callback(new Error("could not parse: " + JSON.stringify(state)));
  }, function (err) {
    if (err) {
      return callback(err);
    }
    if (state.debug) {
      console.log('parseAll ok', JSON.stringify(state, null, '  '));
    }
    return callback(null, state.result);
  });
}

function parseRequiredParameter(state, part, callback) {
  if (state.debug) {
    console.log('parseRequiredParameter', state, part);
  }
  var val = readNextWord(state);
  if (val.length === 0 && !state.completing) {
    return callback(null, false);
  }

  state.result.params[part.name] = val;
  var endsInSpace = skipWhitespace(state);

  if (!endsInSpace && state.completers && state.completers[part.name]) {
    state.completers[part.name](val, function (err, values) {
      if (err) {
        return callback(err);
      }
      state.completer = {
        partial: val,
        value: values
      };
      return callback(null, true);
    });
  } else {
    return callback(null, true);
  }
}

function parseCommandName(state, part, callback) {
  if (state.debug) {
    console.log('parseCommandName', state, part);
  }
  var word = readNextWord(state);
  if (word.toLowerCase() !== part.name.toLowerCase()) {
    if (part.name.toLowerCase().indexOf(word.toLowerCase()) === 0 && isEndOfString(state)) {
      state.completer = {
        partial: word,
        value: part.name + ' '
      };
    }
    if (state.parsing) {
      return callback(new Error("Command name does not match. expected: " + part.name + ", found: " + word));
    } else {
      return callback(COMPLETING_ERROR);
    }
  }
  state.result.name = part.name;
  skipWhitespace(state);
  return callback();
}

function parseOptionalParameters(state, part, callback) {
  if (state.debug) {
    console.log('parseOptionalParameters', state, part);
  }
  if (part.repeat) {
    var saveResults = state.result;
    state.result = {params: {}};
    async.whilst(
      function () { return !isEndOfString(state); },
      function (cb) {
        parseAll(state, part.parts, function (err) {
          if (state.debug) {
            console.log('repeat', state);
          }
          mergeResultsAsArrays(saveResults, state.result);
          cb();
        });
      }, function (err) {
        state.result = saveResults;
        if (err) {
          return callback(err);
        }
        callback();
      }
    );
  } else {
    parseAll(state, part.parts, callback);
  }
}

function parseLiteral(state, part, callback) {
  if (state.debug) {
    console.log('parseLiteral', state, part);
  }

  var i;
  for (i = 0; i < part.names.length; i++) {
    state.result.params[part.names[i]] = false;
  }

  var word = readNextWord(state);
  if (!word) {
    state.completer = {
      partial: word,
      value: part.names
    };

    part.names.forEach(function (name) {
      state.result.params[name] = false;
    });
    return callback(new Error("No values left in string"));
  }

  for (i = 0; i < part.names.length; i++) {
    if (word.toLowerCase() === part.names[i].toLowerCase()) {
      state.result.params[part.names[i]] = true;
      skipWhitespace(state);
      return callback();
    }
  }

  if (isEndOfString(state)) {
    var matches = [];
    for (i = 0; i < part.names.length; i++) {
      if (part.names[i].toLowerCase().indexOf(word.toLowerCase()) === 0) {
        matches.push(part.names[i]);
      }
    }

    if (matches.length > 0) {
      state.completer = {
        partial: word,
        value: matches
      };
    }
  }
  if (state.parsing) {
    return callback(new Error("Partial match"));
  } else {
    return callback(COMPLETING_ERROR);
  }
}

function parseOptionalParameterLiteralOr(state, part, callback) {
  if (state.debug) {
    console.log('parseOptionalParameterLiteralOr', state, part);
  }
  var word = peekNextWord(state);
  var match = null;
  for (var i = 0; i < part.parts.length; i++) {
    for (var n = 0; n < part.parts[i].parts[0].names.length; n++) {
      var literalValue = part.parts[i].parts[0].names[n];
      if (literalValue.toLowerCase() === word.toLowerCase()) {
        match = part.parts[i];
      } else {
        state.result.params[literalValue] = false;
      }
    }
  }

  if (match) {
    if (state.debug) {
      console.log('parseOptionalParameterLiteralOr match', part.parts[i]);
    }
    return parseAll(state, match.parts, callback)
  } else {
    return callback(new Error("No matches found"));
  }
}

function mergeResultsAsArrays(dest, src) {
  for (var key in src.params) {
    var val = src.params[key];
    if (dest.params[key] instanceof Array) {
      dest.params[key].push(val);
    } else if (dest.params[key]) {
      dest.params[key] = [dest.params[key], val];
    } else {
      dest.params[key] = [val];
    }
  }
}