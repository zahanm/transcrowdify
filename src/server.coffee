
path = require 'path'
express = require 'express'
connect_form = require 'connect-form'
mongoose = require 'mongoose'
io = require 'socket.io'
dormouse = require 'dormouse'

models = require './models'

# -- configs

mongoose.connect 'mongodb://localhost/transcrowdify'

dormouse.server 'http://journal.dormou.se:8080'
dormouse.api_key '5e60e715dff55d0ad0f4d807d1cc6dd6d1d044c3'
dormouse.project_id = 1 # transcrowdify

models.define()
server = express.createServer()

# -- server middleware

server.configure ->
  server.use express.logger 'tiny'
  server.use express.cookieParser()
  server.use express.session()
  server.use connect_form keepExtensions: true, uploadDir: path.resolve __dirname, '../uploads'
  server.use server.router
  server.use express.static path.resolve __dirname, '../static'

server.configure 'development', ->
  server.use express.errorHandler dumpExceptions: true, showStack: true

# -- view controllers

controllers = require './controllers'
controllers.configure server

# -- final server setup

port = process.env.PORT || 3779
server.listen port

console.log "Server listening on #{port}"
