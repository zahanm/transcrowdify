(function() {
  var connect_assets, connect_form, controllers, dormouse, express, io, models, mongoose, path, port, server;

  path = require('path');

  express = require('express');

  connect_form = require('connect-form');

  connect_assets = require('connect-assets');

  mongoose = require('mongoose');

  io = require('socket.io');

  dormouse = require('dormouse');

  models = require('./models');

  mongoose.connect('mongodb://localhost/transcrowdify');

  dormouse.server('http://journal.dormou.se:8080');

  dormouse.api_key('5e60e715dff55d0ad0f4d807d1cc6dd6d1d044c3');

  dormouse.project_id(1);

  models.define();

  server = express.createServer();

  server.configure(function() {
    server.use(express.logger('tiny'));
    server.use(express.cookieParser());
    server.use(express.session({
      secret: 'keyboard dog'
    }));
    server.use(express.query());
    server.use(connect_form({
      keepExtensions: true,
      uploadDir: path.resolve(__dirname, '../uploads')
    }));
    server.use(server.router);
    server.use(connect_assets({
      src: path.resolve(__dirname, '../static')
    }));
    return server.use(express.static(path.resolve(__dirname, '../static')));
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
