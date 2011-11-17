
path = require 'path'

exports.normedPathJoin = (paths...) ->
  path.normalize path.join paths...
