
http = require 'http'
async = require 'async'

ids = [433..438]

async.forEachSeries ids, (id, next) ->
    req = http.request
      method: 'DELETE'
      host: 'arya.stanford.edu'
      port: 3777
      path: "/tasks/#{id}.json?api_key=6b044f121358683678e5e21de2202a5e0a0394d5"
    , (res) ->
      console.log "x #{id}"
      next()
    req.end()
  , (err) ->
    if err?
      console.error err
