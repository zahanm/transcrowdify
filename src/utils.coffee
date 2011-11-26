
path = require 'path'

exports.normedPathJoin = (paths...) ->
  path.normalize path.join paths...

exports.randomChoice = (seq) ->
  if seq instanceof Array
    r = Math.floor( Math.random() * seq.length )
    k = r
  else
    k = random_choice Object.keys seq
  seq[k]
