
{ spawn } = require 'child_process'
fs = require 'fs'
url = require 'url'
mongoose = require 'mongoose'
dormouse = require 'dormouse'

utils = require './utils'

# -- models
Journal = mongoose.model 'Journal'
Segment = mongoose.model 'Segment'

exports.configure = (server) ->

  server.set 'view options', layout: false

  server.get '/', (req, res) ->
    q = Segment.where 'completed', false
    p = url.parse req.url, true
    if p.query['exclude']?
      q.where('_id').ne(p.query['exclude'])
    q.run (err, segments) ->
      s = if segments? then utils.randomChoice segments else false
      console.log s # XXX
      res.render 'index.jade', segment: s

  server.post '/upload', (req, res) ->
    if req.form
      req.form.complete (err, fields, files) ->
        segment fields, files
    res.redirect '/status'

  server.post '/transcribe', (req, res) ->
    if req.form
      req.form.complete (err, fields) ->
        transcription = fields['transcribe[content]']
        segment_id = fields['transcribe[_id]']
        q = Segment.update { '_id': segment_id }, { transcription: transcription, completed: true }
        q.run 'update'
        # TODO post answer to dormouse
        res.redirect "/?exclude=#{segment_id}"
    else
      res.redirect '/'

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
    segments.forEach (seg, i) ->
      # create the new task here, maybe use async forEach
      segment = new Segment
        file_path: seg.location
        url: seg.location.slice(seg.location.indexOf('static') + 'static'.length)
        page: seg.page
        trans_type: 'text' # XXX also wrong
        task_id: i # XXX this is all wrong
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
