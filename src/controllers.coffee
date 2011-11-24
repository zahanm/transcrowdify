
{spawn, exec} = require 'child_process'

exports.configure = (server) ->

  server.set 'view options', layout: false

  server.get '/', (req, res) ->
    res.render 'index.jade'

  server.post '/upload', (req, res) ->
    if req.form
      req.form.complete (err, fields, files) ->
        title = fields['upload[title]']
        journal = files['upload[file]']
        # -- divide into segments
        divide journal, (segments) ->
          # -- save to db
          console.log segments # DEBUG
      res.render 'status.jade', errors: []
    else
      res.render 'status.jade', errors: [ 'Upload malfunction' ]

  server.get '/status', (req, res) ->
    res.render 'status.jade', errors: []

divide = (journal, cb) ->
  split = spawn 'python', [ 'pdeff/split.py' ]
  output = ''
  split.stdout.on 'data', (buffer) ->
    output += buffer.toString()
  split.stderr.on 'data', (buffer) ->
    console.error buffer.toString().trim()
  split.on 'exit', (code) ->
    if code isnt 0
      cb []
    try
      cb JSON.parse output
    catch err
      cb []
  split.stdin.write journal.path
  split.stdin.end()
