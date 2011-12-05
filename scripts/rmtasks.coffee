
http = require 'http'
async = require 'async'

switch process.argv.length
  when 3
    from = 0
    to = process.argv[2]
  when 4
    from = process.argv[2]
    to = process.argv[3]
  else
    console.log 'usage: rmtasks.coffee [<from>] <to>'
    process.exit(1)
ids = [from..to]

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
