
nodemailer = require 'nodemailer'

project_email = 'journal@dormou.se'
project_pw = '12qwas12'

exports.check_mail = () ->
  console.log 'Checking email'

nodemailer.SMTP =
  host: 'smtp.gmail.com'
  port: 465
  ssl: true
  use_authentication: true
  user: project_email
  pass: project_pw

exports.send_mail = (to, subject, body) ->
  console.debug "Sending email to #{to}"
  config =
    sender: project_email
    to: to
    subject: subject
    body: body
  nodemailer.send_mail config, (err, success) ->
    console.debug 'Message ' + if success then 'sent' else 'failed'
