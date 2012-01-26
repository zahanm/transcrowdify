
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
dormouse.api_key 'f5d20b8caffe16deb8143a520c38ed2b23fd9def'
dormouse.project_id = 1 # transcrowdify

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
