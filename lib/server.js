(function() {
  var express, path, server, utils;

  path = require('path');

  express = require('express');

  utils = require('./utils');

  server = express.createServer();

  server.configure(function() {
    server.use(express.logger('tiny'));
    server.use(server.router);
    return server.use(express.static(utils.normedPathJoin(__dirname, '../static')));
  });

  server.configure('development', function() {
    return server.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
  });

  server.get('/', function(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    });
    return res.end('Hello world\n');
  });

  server.listen(1337, '127.0.0.1');

  console.log('Server running at http://localhost:1337/');

}).call(this);