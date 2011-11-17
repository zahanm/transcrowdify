(function() {
  var express, server;

  express = require('express');

  server = express.createServer();

  server.get('/', function(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    });
    return res.end('Hello world\n');
  });

  server.listen(1337, '127.0.0.1');

  console.log('Server running at http://localhost:1337/');

}).call(this);
