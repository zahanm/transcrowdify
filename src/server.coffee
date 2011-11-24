
path = require 'path'
express = require 'express'
connect_form = require 'connect-form'

utils = require './utils'

server = express.createServer()

# -- server middleware

server.configure ->
  server.use express.logger 'tiny'
  server.use connect_form keepExtensions: true, uploadDir: utils.normedPathJoin __dirname, '../uploads'
  server.use server.router
  server.use express.static utils.normedPathJoin __dirname, '../static'

server.configure 'development', ->
  server.use express.errorHandler dumpExceptions: true, showStack: true

# -- view controllers

controllers = require './controllers'
controllers.configure server

# -- final server setup

port = 3779
server.listen port

console.log "Server running at http://localhost:#{port}/"
