(function() {
  var connect_form, controllers, dormouse, express, models, mongoose, path, port, server, utils;

  path = require('path');

  express = require('express');

  connect_form = require('connect-form');

  mongoose = require('mongoose');

  dormouse = require('dormouse');

  utils = require('./utils');

  models = require('./models');

  mongoose.connect('mongodb://localhost/transcrowdify');

  dormouse.server('http://journal.dormou.se:8080');

  dormouse.api_key('8eedc3bbeeb04a0d5202937f339176eb81adb70e');

  dormouse.project_id = 1;

  models.define();

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

  port = process.env.PORT || 3779;

  server.listen(port);

  console.log("Server listening on " + port);

}).call(this);
