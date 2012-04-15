
{ spawn } = require 'child_process'
fs = require 'fs'

mongoose = require 'mongoose'
io = require 'socket.io'
dormouse = require 'dormouse'

dmconnect = require './dmconnect'
utils = require './utils'

# models
Journal = mongoose.model 'Journal'
Segment = mongoose.model 'Segment'

exports.configure = (server) ->

  server.set 'view options', layout: false

  # for connect-assets
  css.root = '/styles'

  server.get '/', (req, res) ->
    context = 'user': null, 'task': null
    if req.session.access_token
      context['user'] = req.session.user
      context['logout_url'] = dormouse.logout_url req.headers.host
      dmconnect.fetch_render_task req.session.access_token, (err, task) ->
        console.error err if err
        if task
          context['task'] = task.html
          context['submit'] = task.submit
        res.render 'index.jade', context
    else
      context['login_url'] = dormouse.login_url req.headers.host
      context['signup_url'] = dormouse.signup_url req.headers.host
      res.render 'index.jade', context

  server.get '/task', (req, res) ->
    context = 'task': null
    if req.query['task_id']?
      dmconnect.fetch_render_task_for_id req.query['task_id'], null, (err, task) ->
        console.error err if err
        context['task'] = task.html if task
        context['submit'] = "http://workersandbox.mturk.com/mturk/externalSubmit" # http://www.mturk.com
        q_assignmentId = req.query['assignmentId']
        context['assignmentId'] = if q_assignmentId and q_assignmentId != 'ASSIGNMENT_ID_NOT_AVAILABLE' then q_assignmentId else false
        res.render 'task.jade', context
    else
      res.render 'task.jade', context

  server.get '/checkemail', (req, res) ->
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
        res.redirect "/"
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
        res.redirect "/"
    else
      res.redirect '/'

  server.get '/status', (req, res) ->
    # check mail
    email = require './email'
    email.check_mail()
    # deal with rendering the page
    Segment.find (err, segments) ->
      Journal.find (err, journals) ->
        journals.forEach (j) ->
          j.segments = segments.filter (s) ->
            String(j._id) is String(s.journal_id)
          s_completed = j.segments.filter (s) ->
            s.completed
          j.progress = Math.ceil(s_completed.length / j.segments.length * 100)
          j.numdone = s_completed.length
          j.numsegments = j.segments.length
        res.render 'status.jade', journals: journals

  server.get '/complete', (req, res) ->
    if req.query['journal_id']?
      Journal.findById p.query['journal_id'], (err, journal) ->
        if journal.completed
          res.render 'complete.jade', journal: journal
        else
          finalize_journal journal_id, (j) ->
            res.render 'complete.jade', journal: j
    else
      res.render 'complete.jade', journal: false

  server.get '/transcribed/:journal_id', (req, res) ->
    journal_id = req.params['journal_id']
    text_parts = []
    Segment.find { journal_id: journal_id }, [], { sort: 'layout_order' }, (err, segments) ->
      if segments
        for s in segments
          Array.prototype.push.apply( text_parts, s.transcription.split('\n') )
      res.render 'transcribed.jade', { 'segments': text_parts }

  # dormouse authentication
  dormouse.setup_auth server

  # socket.io config
  io = io.listen server

  io.configure 'production', ->
    io.enable 'browser client minification'
    io.enable 'browser client etag'
    io.enable 'browser client gzip'
    io.set 'log level', 1

# -- helper functions

record_transcription = (s_id, t) ->
  Segment.findById s_id, (err, seg) ->
    seg.transcription = t
    seg.completed = true
    io.sockets.emit 'updatesegment', seg
    seg.save (err) ->
      Segment.find { 'journal_id': seg.journal_id }, (err, segs) ->
        alldone = segs.every (s) ->
          s.completed
        if alldone
          finalize_journal seg.journal_id

finalize_journal = (j_id, cb) ->
  Journal.findById j_id, (err, journal) ->
    join journal, (out) ->
      if out.transcribed? and out.searchable?
        journal.completed = true
        journal.transcribed = "/transcribed/#{j_id}"
        journal.searchable = utils.fsPathToUrl out.searchable
        journal.save (err) ->
          notify_finalized journal
          cb journal if cb

notify_finalized = (journal) ->
  # notify over web
  io.sockets.emit 'completejournal', journal
  # notify over email
  config =
    to: journal.email
    subject: "You're journal transcription is complete!"
    body:
      """
      You can access the searchable version of your journal at http://journal.dormou.se#{journal.searchable} .
      The transcribed version can be found at http://journal.dormou.se#{journal.transcribed} .

      Powered by http://dormou.se
      """
  email = require './email'
  email.send_mail config

accepted_types =
  'application/pdf': 'pdf'
  'image/jpeg': 'jpg'
  'image/jpg': 'jpg'
  'image/png': 'png'

split = (ops) ->
  if ops.file_type not of accepted_types
    return fs.unlink ops.file_path
  # -- save Journal to db
  journal = new Journal
    title: ops.title
    email: ops.email
    file_path: ops.file_path
  journal.save dbchecker
  # -- divide into segments
  type = accepted_types[ops.file_type]
  json_spawn './py_packages/bin/python', [ 'pdeff/split.py', type ], journal.file_path, [], save_segments_to_db.bind(this, journal)

exports.accepted_types = accepted_types
exports.split = split

save_segments_to_db = (journal, segments) ->
  # -- save Segments to db
  context = {}
  context.segments = segments.map (seg, i) ->
    segment = new Segment
      file_path: seg.location
      url: utils.fsPathToUrl seg.location
      page: seg.page
      layout_order: i+1
      journal_id: journal._id
    segment.save (err, saved) ->
      create_categorize_task saved
    segment
  for own k, v of journal._doc # XXX should not rely on private api
    context[k] = v
  io.sockets.emit 'newjournal', context

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
    eligibility: { predicate: null, communities: [ 'mturk' ] }
    parameters:
      segment_url: segment.url
      mode: segment.mode
      segment_id: segment._id
      turk_title: "Transcribe Text"
      turk_description: "Please transcribe the text you see in the image."
      turk_reward: 0.02
      turk_url: "http://journal.dormou.se/task/"
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
