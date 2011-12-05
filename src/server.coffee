
path = require 'path'
express = require 'express'
connect_form = require 'connect-form'
mongoose = require 'mongoose'
dormouse = require 'dormouse'

utils = require './utils'
models = require './models'

# -- configs

mongoose.connect 'mongodb://localhost/transcrowdify'

dormouse.server 'http://arya.stanford.edu:3777'
dormouse.api_key '6b044f121358683678e5e21de2202a5e0a0394d5'
dormouse.project_id = 21 # transcrowdify
dormouse.transcribe_template_id = 13 # zahanm/transcribe.template
dormouse.categorize_template_id = 14 # zahanm/categorize.template

models.define()
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
