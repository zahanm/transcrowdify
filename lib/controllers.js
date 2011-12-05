(function() {
  var Journal, Segment, create_categorize_task, create_transcribe_task, dbchecker, dormouse, fs, join, json_spawn, mongoose, save_segments_to_db, spawn, split, url, utils;

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
      return res.render('index.jade');
    });
    server.post('/upload', function(req, res) {
      if (req.form) {
        req.form.complete(function(err, fields, files) {
          return split(fields, files);
        });
      }
      return res.redirect('/status');
    });
    server.post('/categorize', function(req, res) {
      if (req.form) {
        return req.form.complete(function(err, fields) {
          var category, q, segment_id;
          category = fields['categorize[content]'];
          segment_id = fields['categorize[_id]'];
          q = Segment.update({
            '_id': segment_id
          }, {
            mode: category
          });
          q.run('update', function(err, segment) {
            return create_transcribe_task(segment);
          });
          return res.redirect("/?exclude=" + segment_id);
        });
      } else {
        return res.redirect('/');
      }
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

  split = function(fields, files) {
    var journal, uploaded;
    uploaded = files['upload[file]'];
    if (uploaded.type !== 'application/pdf') return fs.unlink(uploaded.path);
    journal = new Journal({
      title: fields['upload[title]'],
      file_path: uploaded.path
    });
    journal.save(dbchecker);
    return json_spawn('python', ['pdeff/split.py'], journal.file_path, [], save_segments_to_db);
  };

  save_segments_to_db = function(segments) {
    return segments.forEach(function(seg, i) {
      var segment;
      segment = new Segment({
        file_path: seg.location,
        url: utils.fsPathToUrl(seg.location),
        page: seg.page,
        layout_order: i,
        journal_id: journal._id
      });
      return segment.save(function(err, saved) {
        return create_categorize_task(saved);
      });
    });
  };

  create_categorize_task = function(segment) {
    var task_info;
    task_info = {
      name: "" + journal._id + " " + segment._id + " categorize",
      project_id: dormouse.project_id,
      template_id: dormouse.categorize_template_id,
      parameters: {
        segment_url: segment.url,
        segment_id: segment._id
      }
    };
    return dormouse.createTask(task_info, function(r) {
      if (!r) throw new Error('Error creating categorize dormouse task');
    });
  };

  create_transcribe_task = function(segment) {
    var task_info;
    task_info = {
      name: "" + journal._id + " " + segment._id + " transcribe",
      project_id: dormouse.project_id,
      template_id: dormouse.transcribe_template_id,
      parameters: {
        segment_url: segment.url,
        mode: segment.mode,
        segment_id: segment._id
      }
    };
    return dormouse.createTask(task_info, function(r) {
      if (!r) throw new Error('Error creating transcribe dormouse task');
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
