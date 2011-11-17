(function() {
  var path;
  var __slice = Array.prototype.slice;

  path = require('path');

  exports.normedPathJoin = function() {
    var paths;
    paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return path.normalize(path.join.apply(path, paths));
  };

}).call(this);
