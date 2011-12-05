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

  dormouse.server('http://arya.stanford.edu:3777');

  dormouse.api_key('6b044f121358683678e5e21de2202a5e0a0394d5');

  dormouse.project_id = 21;

  dormouse.transcribe_template_id = 11;

  dormouse.categorize_template_id = 12;

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

  port = 3779;

  server.listen(port);

  console.log("Server running at http://localhost:" + port + "/");

}).call(this);
