(function() {
  var Journal, Segment, dbchecker, divide, dormouse, fs, join, json_spawn, mongoose, segment, spawn, utils;

  spawn = require('child_process').spawn;

  fs = require('fs');

  mongoose = require('mongoose');

  dormouse = require('dormouse');

  utils = require('./utils');

  Journal = mongoose.model('Journal');

  Segment = mongoose.model('Segment');

  exports.configure = function(server) {
    server.set('view options', {
      layout: false
    });
    server.get('/', function(req, res) {
      return dormouse.getProjectTasks(dormouse.project_id, function(tasks) {
        var t;
        t = utils.randomChoice(tasks);
        console.log(t.task);
        return res.render('index.jade', {
          task: t.task
        });
      });
    });
    server.post('/upload', function(req, res) {
      if (req.form) {
        req.form.complete(function(err, fields, files) {
          return segment(fields, files);
        });
      }
      return res.redirect('/status');
    });
    server.get('/status', function(req, res) {
      return res.render('status.jade', {
        errors: []
      });
    });
    return server.get('/complete', function(req, res) {
      return join(function(transcribed, searchable) {
        return res.render('complete.jade', {
          transcribed: transcribed,
          searchable: searchable
        });
      });
    });
  };

  segment = function(fields, files) {
    var journal, uploaded;
    uploaded = files['upload[file]'];
    if (uploaded.type !== 'application/pdf') return fs.unlink(uploaded.path);
    journal = new Journal({
      title: fields['upload[title]'],
      file_path: uploaded.path
    });
    journal.save(dbchecker);
    return divide(journal, function(segments) {
      return segments.forEach(function(seg) {
        segment = new Segment({
          file_path: seg.location,
          page: seg.page,
          trans_type: seg.type,
          journal_id: journal._id
        });
        return segment.save(dbchecker);
      });
    });
  };

  divide = function(journal, cb) {
    return json_spawn('python', ['pdeff/split.py'], journal.file_path, [], cb);
  };

  join = function(cb) {
    if (cb) cb('/images/loading.gif', '/images/loading.gif');
    return json_spawn('python', ['pdeff/join.py'], '', {}, cb);
  };

  json_spawn = function(command, args, input, def, cb) {
    var child, output;
    child = spawn(command, args);
    output = '';
    child.stdout.on('data', function(buffer) {
      return output += buffer.toString();
    });
    child.stderr.on('data', function(buffer) {
      return console.error(buffer.toString().trim());
    });
    child.on('exit', function(code) {
      if (code !== 0) cb(def);
      try {
        return cb(JSON.parse(output));
      } catch (err) {
        return cb(def);
      }
    });
    child.stdin.write(input);
    return child.stdin.end();
  };

  dbchecker = function(err) {
    if (err) throw new Error('Error saving model to db');
  };

}).call(this);
