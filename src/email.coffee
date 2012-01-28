
fs = require 'fs'
path = require 'path'
nodemailer = require 'nodemailer'
ImapConnection = require('imap').ImapConnection
MailParser = require("mailparser").MailParser

controllers = require './controllers'

project_email = 'journal@dormou.se'
project_pw = '12qwas12'

imap = new ImapConnection
  username: project_email
  password: project_pw
  host: 'imap.gmail.com'
  port: 993
  secure: true

cmd = 0

next = (err) ->
  if (err)
    throw err;
  else if cmd < cmds.length
    cmds[cmd++].apply(this, Array.prototype.slice.call(arguments).slice(1))

cmds = [
  ->
    imap.connect next
  ->
    imap.openBox 'INBOX', next
  (box) ->
    imap.search [ 'UNSEEN' ], next
  (msg_ids) ->
    if not msg_ids.length
      console.info 'Inbox empty'
      return imap.logout
    fetch = imap.fetch msg_ids, { request: { headers: false, body: 'full' } }
    fetch.on 'message', get_message
    fetch.on 'end', ->
      console.info 'Done fetching all messages'
      next null, msg_ids
  (msg_ids) ->
    imap.addFlags msg_ids, 'Seen', next
  ->
    console.info 'Done seeing messages, now logging out'
    imap.logout next
]

setup_parser = ->
  mailparser = new MailParser
    streamAttachments: true
  disk_fname = attach_fname = attach_type = null
  mailparser.on 'attachment', (attachment) ->
    if attachment.contentType of controllers.accepted_types
      attach_type = attachment.contentType
      attach_fname = attachment.generatedFileName
      disk_fname = path.resolve __dirname, '../uploads/', attach_fname
      # check if disk_fname exists, set to random name if so
      if path.existsSync disk_fname
        ext = path.extname attach_fname
        rand_fname = gen_random_fname ext
        disk_fname = path.resolve __dirname, '../uploads', rand_fname
      output = fs.createWriteStream fname
      attachment.stream.pipe output
  mailparser.on 'end', (mail) ->
    if attach_fname and disk_fname
      options =
        title: mail.subject
        email: mail.from[0].address
        file_path: disk_fname
        file_type: attach_type
      console.info 'Splitting the journal'
      controllers.split options
  mailparser

get_message = (msg) ->
  console.info 'We have a new email!'
  mailparser = setup_parser()
  msg.on 'data', (chunk) ->
    mailparser.write chunk
  msg.on 'end', ->
    mailparser.end()

exports.check_mail = ->
  console.info 'Checking email'
  cmd = 0
  next()

nodemailer.SMTP =
  host: 'smtp.gmail.com'
  port: 465
  ssl: true
  use_authentication: true
  user: project_email
  pass: project_pw

# Takes in sending config of the form
#
# to: email
# subject: string
# body: plaintext body
#
exports.send_mail = (config) ->
  console.info "Sending email to #{to}"
  config.sender = project_email
  nodemailer.send_mail config, (err, success) ->
    console.info 'Message ' + if success then 'sent' else 'failed'

# Generate a random file name
# taken from https://github.com/bruce/node-temp/
gen_random_fname = (ext) ->
  now = new Date()
  name = [
    now.getYear(), now.getMonth(), now.getDay(),
    '-',
    process.pid,
    '-',
    (Math.random() * 0x100000000 + 1).toString(36),
    ext
  ].join('')
  name
