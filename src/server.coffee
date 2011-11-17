
path = require 'path'
express = require 'express'

utils = require './utils'

server = express.createServer()

# -- server middleware

server.configure ->
  server.use express.logger 'tiny'
  server.use server.router
  server.use express.static utils.normedPathJoin __dirname, '../static'

server.configure 'development', ->
  server.use express.errorHandler dumpExceptions: true, showStack: true

# -- view controllers

server.set 'view options', layout: false

server.get '/', (req, res) ->
  res.render 'index.jade'

# -- final server setup

server.listen 1337, '127.0.0.1'

console.log 'Server running at http://localhost:1337/'
