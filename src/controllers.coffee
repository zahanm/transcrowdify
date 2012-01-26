
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
    res.render 'index.jade'

  server.post '/upload', (req, res) ->
    if req.form
      req.form.complete (err, fields, files) ->
        split fields, files
    res.redirect '/status'

  server.post '/categorize', (req, res) ->
    if req.form
      req.form.complete (err, fields) ->
        category = fields['categorize[content]']
        task_id = fields['categorize[task_id]']
        segment_id = fields['categorize[segment_id]']
        Segment.findById segment_id, (err, segment) ->
          segment.mode = category
          segment.save dbchecker
          create_transcribe_task segment
        # post answer to dormouse
        dormouse.answerTask task_id, { mode: category }, (err, r) ->
          console.log r # DEBUG
          throw new Error('Error answering categorize dormouse task') if err
        res.redirect "/?exclude=#{segment_id}"
    else
      res.redirect '/'

  server.post '/transcribe', (req, res) ->
    if req.form
      req.form.complete (err, fields) ->
        transcription = fields['transcribe[content]']
        task_id = fields['transcribe[task_id]']
        segment_id = fields['transcribe[segment_id]']
        q = Segment.update { '_id': segment_id }, { transcription: transcription, completed: true }
        q.run 'update'
        # post answer to dormouse
        dormouse.answerTask task_id, { transcription: transcription }, (err, r) ->
          console.log r # DEBUG
          throw new Error('Error answering transcribe dormouse task') if err
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
          s_completed = segments.filter (s) ->
            s.completed
          j.progress = Math.ceil(s_completed.length / j.segments.length * 100)
          j.completed = journal.completed || (s_completed.length == j.segments.length)
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

split = (fields, files) ->
  uploaded = files['upload[file]']
  if uploaded.type isnt 'application/pdf'
    return fs.unlink uploaded.path
  # -- save Journal to db
  journal = new Journal
    title: fields['upload[title]']
    email: fields['upload[email]']
    file_path: uploaded.path
  journal.save dbchecker
  # -- divide into segments
  json_spawn './py_packages/bin/python', [ 'pdeff/split.py' ], journal.file_path, [], save_segments_to_db.bind(this, journal)

save_segments_to_db = (journal, segments) ->
  # -- save Segments to db
  segments.forEach (seg, i) ->
    segment = new Segment
      file_path: seg.location
      url: utils.fsPathToUrl seg.location
      page: seg.page
      layout_order: i
      journal_id: journal._id
    segment.save (err, saved) ->
      create_categorize_task saved

create_categorize_task = (segment) ->
  # -- create dormouse task for segment
  task_info =
    name: "categorize #{segment._id}"
    project_id: dormouse.project_id
    template_id: 2 # zahanm/categorize.template
    parameters:
      segment_url: segment.url
      segment_id: segment._id
  dormouse.createTask task_info, (err, r) ->
    throw new Error('Error creating categorize dormouse task') if err

create_transcribe_task = (segment) ->
  # -- create dormouse task for segment
  task_info =
    name: "transcribe #{segment._id}"
    project_id: dormouse.project_id
    template_id: 1 # zahanm/transcribe.template
    parameters:
      segment_url: segment.url
      mode: segment.mode
      segment_id: segment._id
  dormouse.createTask task_info, (err, r) ->
    throw new Error('Error creating transcribe dormouse task') if err

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
      type: s.mode
    json_spawn './py_packages/bin/python', [ 'pdeff/join.py' ], input, {}, cb

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
