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

  server.set('view options', {
    layout: false
  });

  server.get('/', function(req, res) {
    return res.render('index.jade');
  });

  server.listen(1337, '127.0.0.1');

  console.log('Server running at http://localhost:1337/');

}).call(this);
