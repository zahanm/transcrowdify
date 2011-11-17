
path = require 'path'
express = require 'express'

utils = require './utils'

server = express.createServer()

server.configure ->
  server.use express.logger 'tiny'
  server.use server.router
  server.use express.static utils.normedPathJoin __dirname, '../static'

server.configure 'development', ->
  server.use express.errorHandler dumpExceptions: true, showStack: true

server.get '/', (req, res) ->
  res.writeHead 200, 'Content-Type': 'text/plain'
  res.end 'Hello world\n'

server.listen 1337, '127.0.0.1'

console.log 'Server running at http://localhost:1337/'
