
{ spawn } = require 'child_process'
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

# -- helper functions

segment = (fields, files) ->
  uploaded = files['upload[file]']
  if uploaded.type isnt 'application/pdf'
    return fs.unlink uploaded.path
  # -- save Journal to db
  journal = new Journal
    title: fields['upload[title]']
    file_path: uploaded.path
  journal.save checker
  # -- divide into segments
  divide journal, (segments) ->
    # -- save Segments to db
    segments.forEach (seg) ->
      segment = new Segment
        file_path: seg.location
        page: seg.page
        trans_type: seg.type
        journal_id: journal._id
      segment.save checker

divide = (journal, cb) ->
  split = spawn 'python', [ 'pdeff/split.py' ]
  output = ''
  split.stdout.on 'data', (buffer) ->
    output += buffer.toString()
  split.stderr.on 'data', (buffer) ->
    console.error buffer.toString().trim()
  split.on 'exit', (code) ->
    cb [] if code isnt 0
    try
      cb JSON.parse output
    catch err
      cb []
  split.stdin.write journal.file_path
  split.stdin.end()

checker = (err) ->
  throw new Error 'Error saving model to db' if err
