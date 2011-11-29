
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
    Segment.find (err, segments) ->
      Journal.find (err, journals) ->
        context = journals.map (journal) ->
          j = {}
          j.title = journal.title
          j._id = journal._id
          j.segments = segments.filter (s) ->
            String(journal._id) is String(s.journal_id)
          j.completed = journal.completed || segments.every (s) ->
            s.completed
          j
        res.render 'status.jade', journals: context

  server.get '/complete', (req, res) ->
    p = url.parse req.url, true
    if p.query['journal_id']?
      Journal.findById p.query['journal_id'], (err, journal) ->
        if journal.completed
          res.render 'complete.jade', journal: journal
        else
          join journal, (output) ->
            if output.transcribed? and output.searchable?
              journal.completed = true
              journal.transcribed = utils.fsPathToUrl output.transcribed
              journal.searchable = utils.fsPathToUrl output.searchable
              journal.save (err) ->
                res.render 'complete.jade', journal: journal
            else
              res.render 'complete.jade', journal: false
    else
      res.render 'complete.jade', journal: false

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
      segment = new Segment
        file_path: seg.location
        url: utils.fsPathToUrl seg.location
        page: seg.page
        trans_type: 'text' # XXX also wrong
        layout_order: i
        journal_id: journal._id
      segment.save (err, saved) ->
        # -- create dormouse task for segment
        task_info =
          name: "#{journal._id} #{saved._id}"
          project_id: dormouse.project_id
          template_id: dormouse.template_id
          parameters:
            segment_url: saved.url
            mode: saved.trans_type
            id: saved._id
        dormouse.createTask task_info, (r) ->
          Segment.update( { _id: saved._id }, { task_id: r.task.id }, {}, dbchecker)

divide = (journal, cb) ->
  json_spawn 'python', [ 'pdeff/split.py' ], journal.file_path, [], cb

join = (journal, cb) ->
  Segment.find { journal_id: journal._id }, [], { sort: 'layout_order' }, (err, segments) ->
    incompleted = segments.some (s) ->
      not s.completed
    if incompleted
      cb {}
    input = JSON.stringify segments.map (s) ->
      page: s.page
      location: s.file_path
      transcription: s.transcription
      type: s.trans_type
    json_spawn 'python', [ 'pdeff/join.py' ], input, {}, cb

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
  true

dbchecker = (err, doc) ->
  throw new Error 'Error saving #{doc} to db' if err
