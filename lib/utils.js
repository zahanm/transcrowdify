(function() {
  var path;
  var __slice = Array.prototype.slice;

  path = require('path');

  exports.normedPathJoin = function() {
    var paths;
    paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return path.normalize(path.join.apply(path, paths));
  };

  exports.randomChoice = function(seq) {
    var k, r;
    if (seq instanceof Array) {
      r = Math.floor(Math.random() * seq.length);
      k = r;
    } else {
      k = random_choice(Object.keys(seq));
    }
    return seq[k];
  };

}).call(this);
