
http = require 'http'
async = require 'async'

switch process.argv.length
  when 3
    from = 0
    to = Number process.argv[2]
  when 4
    from = Number process.argv[2]
    to = Number process.argv[3]
  else
    console.log 'usage: rmtasks.coffee [<from>] <to>'
    process.exit(1)
ids = [from..to]

async.forEachSeries ids, (id, next) ->
    req = http.request
      method: 'DELETE'
      host: 'journal.dormou.se'
      port: 8080
      path: "/tasks/#{id}.json?api_key=5e60e715dff55d0ad0f4d807d1cc6dd6d1d044c3"
    , (res) ->
      console.log "x #{id}"
      next()
    req.end()
  , (err) ->
    if err?
      console.error err
