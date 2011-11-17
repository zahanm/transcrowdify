
express = require 'express'

server = express.createServer()

server.get '/', (req, res) ->
  res.writeHead 200, 'Content-Type': 'text/plain'
  res.end 'Hello world\n'

server.listen 1337, '127.0.0.1'

console.log 'Server running at http://localhost:1337/'
