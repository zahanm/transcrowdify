
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

  server.get '/testemail', (req, res) ->
    email = require './email'
    email.check_mail()
    res.end 'Fetching email'

  server.post '/upload', (req, res) ->
    if req.form
      req.form.complete (err, fields, files) ->
        uploaded = files['upload[file]']
        options =
          title: fields['upload[title]']
          email: fields['upload[email]']
          file_path: uploaded.path
          file_type: uploaded.type
        split options
    res.redirect '/'

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
        record_transcription segment_id, transcription
        # post answer to dormouse
        dormouse.answerTask task_id, { transcription: transcription }, (err, r) ->
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
          s_completed = j.segments.filter (s) ->
            s.completed
          j.progress = Math.ceil(s_completed.length / j.segments.length * 100)
          j.completed = journal.completed
          j.email = journal.email
          if j.completed
            j.searchable = journal.searchable
            j.transcribed = journal.transcribed
          j
        res.render 'status.jade', journals: context

  server.get '/complete', (req, res) ->
    p = url.parse req.url, true
    if p.query['journal_id']?
      Journal.findById p.query['journal_id'], (err, journal) ->
        if journal.completed
          res.render 'complete.jade', journal: journal
        else
          finalize_journal journal_id, (j) ->
            res.render 'complete.jade', journal: j
    else
      res.render 'complete.jade', journal: false

# -- helper functions

record_transcription = (s_id, t) ->
  Segment.findById s_id, (err, s) ->
    s.transcription = t
    s.completed = true
    s.save (err) ->
      Segment.find { 'journal_id': s.journal_id }, (err, ss) ->
        alldone = ss.every (seg) ->
          seg.completed
        if alldone
          finalize_journal seg.journal_id

finalize_journal = (j_id, cb) ->
  Journal.findById j_id, (err, journal) ->
    join journal, (out) ->
      if out.transcribed? and out.searchable?
        journal.completed = true
        journal.transcribed = utils.fsPathToUrl out.transcribed
        journal.searchable = utils.fsPathToUrl out.searchable
        journal.save (err) ->
          notify_finalized journal
          cb journal if cb

notify_finalized = (journal) ->
  config =
    to: journal.email
    subject: "You're journal transcription is complete!"
    body:
      """
      You can access the searchable version of your journal at #{journal.searchable} .
      The transcribed version can be found at #{journal.transcribed} .

      Powered by http://journal.dormou.se
      """
  email = require './email'
  email.send_mail config

split = (ops) ->
  if ops.file_type isnt 'application/pdf'
    return fs.unlink ops.file_path
  # -- save Journal to db
  journal = new Journal
    title: ops.title
    email: ops.email
    file_path: ops.file_path
  journal.save dbchecker
  # -- divide into segments
  json_spawn './py_packages/bin/python', [ 'pdeff/split.py' ], journal.file_path, [], save_segments_to_db.bind(this, journal)

exports.split = split

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
