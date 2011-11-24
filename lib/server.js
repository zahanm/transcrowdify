(function() {
  var connect_form, controllers, express, path, port, server, utils;

  path = require('path');

  express = require('express');

  connect_form = require('connect-form');

  utils = require('./utils');

  server = express.createServer();

  server.configure(function() {
    server.use(express.logger('tiny'));
    server.use(connect_form({
      keepExtensions: true,
      uploadDir: utils.normedPathJoin(__dirname, '../uploads')
    }));
    server.use(server.router);
    return server.use(express.static(utils.normedPathJoin(__dirname, '../static')));
  });

  server.configure('development', function() {
    return server.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
  });

  controllers = require('./controllers');

  controllers.configure(server);

  port = 3779;

  server.listen(port);

  console.log("Server running at http://localhost:" + port + "/");

}).call(this);
