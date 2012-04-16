
Mongoose = require 'mongoose'
dormouse = require 'dormouse'

dmconnect = require './dmconnect'

# models
Journal = Mongoose.model 'Journal'
Segment = Mongoose.model 'Segment'

exports.check_responses = (access_token) ->

  dormouse.refreshTurkResponses () ->

    q = dormouse.getTasks()
    q.authenticate access_token

    Segment.find (err, segments) ->
      segments.forEach (segment) ->
        console.log segment
