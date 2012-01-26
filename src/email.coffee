
fs = require 'fs'
nodemailer = require 'nodemailer'
ImapConnection = require('imap').ImapConnection
MailParser = require("mailparser").MailParser

controllers = require './controllers'
utils = require './utils'

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
      console.log 'Inbox empty'
      return imap.logout
    fetch = imap.fetch msg_ids, { request: { headers: false, body: 'full' } }
    fetch.on 'message', get_message
    fetch.on 'end', ->
      console.log 'Done fetching all messages'
      next null, msg_ids
  (msg_ids) ->
    imap.addFlags msg_ids, 'Seen', next
  ->
    console.log 'Done seeing messages, now logging out'
    imap.logout next
]

mailparser = new MailParser
  streamAttachments: true

mailparser.on 'attachment', (attachment) ->
  fname = utils.normedPathJoin __dirname, '../uploads/', attachment.generatedFileName
  output = fs.createWriteStream fname
  attachment.stream.pipe output

allowed_types = [ 'application/pdf' ]

mailparser.on 'end', (mail) ->
  attachment = null
  for a in mail.attachments
    if a.contentType in allowed_types
      attachment = a
  if attachment
    fname = utils.normedPathJoin __dirname, '../uploads/', attachment.generatedFileName
    options =
      title: mail.subject
      email: mail.from[0].address
      file_path: fname
      file_type: attachment.contentType
    console.log 'Splitting the journal'
    controllers.split options

get_message = (msg) ->
  console.log 'We have a new email!'
  msg.on 'data', (chunk) ->
    mailparser.write chunk
  msg.on 'end', ->
    mailparser.end()

exports.check_mail = ->
  console.log 'Checking email'
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
  console.log "Sending email to #{to}"
  config.sender = project_email
  nodemailer.send_mail config, (err, success) ->
    console.log 'Message ' + if success then 'sent' else 'failed'
