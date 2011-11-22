
path = require 'path'
express = require 'express'
# XXX connect_form = require 'connect-form'

utils = require './utils'

server = express.createServer()

# -- server middleware

server.configure ->
  server.use express.logger 'tiny'
# XXX  server.use connect_form.form keepExtensions: true, uploadDir: utils.normedPathJoin __dirname, '../uploads'
  server.use server.router
  server.use express.static utils.normedPathJoin __dirname, '../static'

server.configure 'development', ->
  server.use express.errorHandler dumpExceptions: true, showStack: true

# -- view controllers

controllers = require './controllers'
controllers.configure server

# -- final server setup

server.listen 1337, '127.0.0.1'

console.log 'Server running at http://localhost:1337/'
