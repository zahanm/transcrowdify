
path = require 'path'

exports.randomChoice = (seq) ->
  if seq instanceof Array
    r = Math.floor( Math.random() * seq.length )
    k = r
  else
    k = random_choice Object.keys seq
  seq[k]

exports.fsPathToUrl = (p) ->
  starter = p.indexOf 'static'
  p.slice starter + 'static'.length

class CountDownLatch

  constructor: (@count, @finished) ->

  countDown: ->
    throw new Error('Countdown is already done') unless @count > 0
    @count -= 1
    @Finished() if @count == 0

exports.CountDownLatch = CountDownLatch
