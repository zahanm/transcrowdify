(function() {
  var Journal, Segment, dbchecker, dormouse, fs, join, json_spawn, mongoose, segment, spawn, url, utils;

  spawn = require('child_process').spawn;

  fs = require('fs');

  url = require('url');

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
      var p, q;
      q = Segment.where('completed', false);
      p = url.parse(req.url, true);
      if (p.query['exclude'] != null) q.where('_id').ne(p.query['exclude']);
      return q.run(function(err, segments) {
        var s;
        s = segments != null ? utils.randomChoice(segments) : false;
        return res.render('index.jade', {
          segment: s
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
    server.post('/transcribe', function(req, res) {
      if (req.form) {
        return req.form.complete(function(err, fields) {
          var q, segment_id, transcription;
          transcription = fields['transcribe[content]'];
          segment_id = fields['transcribe[_id]'];
          q = Segment.update({
            '_id': segment_id
          }, {
            transcription: transcription,
            completed: true
          });
          q.run('update');
          return res.redirect("/?exclude=" + segment_id);
        });
      } else {
        return res.redirect('/');
      }
    });
    server.get('/status', function(req, res) {
      return Segment.find(function(err, segments) {
        return Journal.find(function(err, journals) {
          var context;
          context = journals.map(function(journal) {
            var j;
            j = {};
            j.title = journal.title;
            j._id = journal._id;
            j.segments = segments.filter(function(s) {
              return String(journal._id) === String(s.journal_id);
            });
            j.completed = journal.completed || segments.every(function(s) {
              return s.completed;
            });
            return j;
          });
          return res.render('status.jade', {
            journals: context
          });
        });
      });
    });
    return server.get('/complete', function(req, res) {
      var p;
      p = url.parse(req.url, true);
      if (p.query['journal_id'] != null) {
        return Journal.findById(p.query['journal_id'], function(err, journal) {
          if (journal.completed) {
            return res.render('complete.jade', {
              journal: journal
            });
          } else {
            return join(journal, function(output) {
              if ((output.transcribed != null) && (output.searchable != null)) {
                journal.completed = true;
                journal.transcribed = utils.fsPathToUrl(output.transcribed);
                journal.searchable = utils.fsPathToUrl(output.searchable);
                return journal.save(function(err) {
                  return res.render('complete.jade', {
                    journal: journal
                  });
                });
              } else {
                return res.render('complete.jade', {
                  journal: false
                });
              }
            });
          }
        });
      } else {
        return res.render('complete.jade', {
          journal: false
        });
      }
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
    return json_spawn('python', ['pdeff/split.py'], journal.file_path, [], function(segments) {
      return segments.forEach(function(seg, i) {
        segment = new Segment({
          file_path: seg.location,
          url: utils.fsPathToUrl(seg.location),
          page: seg.page,
          mode: 'text',
          layout_order: i,
          journal_id: journal._id
        });
        return segment.save(function(err, saved) {
          var task_info;
          task_info = {
            name: "" + journal._id + " " + saved._id,
            project_id: dormouse.project_id,
            template_id: dormouse.template_id,
            parameters: {
              segment_url: saved.url,
              mode: saved.mode,
              segment_id: saved._id
            }
          };
          return dormouse.createTask(task_info, function(r) {
            return Segment.update({
              _id: saved._id
            }, {
              task_id: r.task.id
            }, {}, dbchecker);
          });
        });
      });
    });
  };

  join = function(journal, cb) {
    return Segment.find({
      journal_id: journal._id
    }, [], {
      sort: 'layout_order'
    }, function(err, segments) {
      var incompleted, input;
      incompleted = segments.some(function(s) {
        return !s.completed;
      });
      if (incompleted) cb({});
      input = JSON.stringify(segments.map(function(s) {
        return {
          page: s.page,
          location: s.file_path,
          transcription: s.transcription,
          type: s.mode
        };
      }));
      return json_spawn('python', ['pdeff/join.py'], input, {}, cb);
    });
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
    child.stdin.end();
    return true;
  };

  dbchecker = function(err, doc) {
    if (err) throw new Error('Error saving #{doc} to db');
  };

}).call(this);
