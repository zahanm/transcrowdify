
{ spawn } = require 'child_process'
fs = require 'fs'
mongoose = require 'mongoose'

# -- models
Journal = mongoose.model 'Journal'
Segment = mongoose.model 'Segment'

exports.configure = (server) ->

  server.set 'view options', layout: false

  server.get '/', (req, res) ->
    res.render 'index.jade'

  server.post '/upload', (req, res) ->
    if req.form
      req.form.complete (err, fields, files) ->
        segment fields, files
    res.redirect '/status'

  server.get '/status', (req, res) ->
    res.render 'status.jade', errors: []

  server.get '/complete', (req, res) ->
    join (transcribed, searchable) ->
      res.render 'complete.jade',
        transcribed: transcribed
        searchable: searchable

# -- helper functions

segment = (fields, files) ->
  uploaded = files['upload[file]']
  if uploaded.type isnt 'application/pdf'
    return fs.unlink uploaded.path
  # -- save Journal to db
  journal = new Journal
    title: fields['upload[title]']
    file_path: uploaded.path
  journal.save dbchecker
  # -- divide into segments
  divide journal, (segments) ->
    # -- save Segments to db
    segments.forEach (seg) ->
      segment = new Segment
        file_path: seg.location
        page: seg.page
        trans_type: seg.type
        journal_id: journal._id
      segment.save dbchecker

divide = (journal, cb) ->
  json_spawn 'python', [ 'pdeff/split.py' ], journal.file_path, [], cb

join = (cb) ->
  cb '/images/loading.gif', '/images/loading.gif' if cb
  # -- now it really begins
  json_spawn 'python', [ 'pdeff/join.py' ], '', {}, cb

json_spawn = (command, args, input, def, cb) ->
  child = spawn command, args
  output = ''
  child.stdout.on 'data', (buffer) ->
    output += buffer.toString()
  child.stderr.on 'data', (buffer) ->
    console.error buffer.toString().trim()
  child.on 'exit', (code) ->
    cb def if code isnt 0
    try
      cb JSON.parse output
    catch err
      cb def
  child.stdin.write input
  child.stdin.end()

dbchecker = (err) ->
  throw new Error 'Error saving model to db' if err
