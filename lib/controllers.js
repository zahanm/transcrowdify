(function() {
  var Journal, Segment, accepted_types, create_categorize_task, create_transcribe_task, dbchecker, dormouse, finalize_journal, fs, io, join, json_spawn, mongoose, notify_finalized, record_transcription, save_segments_to_db, spawn, split, url, utils;

  spawn = require('child_process').spawn;

  fs = require('fs');

  url = require('url');

  mongoose = require('mongoose');

  io = require('socket.io');

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
    server.get('/testemail', function(req, res) {
      var email;
      email = require('./email');
      email.check_mail();
      return res.end('Fetching email');
    });
    server.post('/upload', function(req, res) {
      if (req.form) {
        req.form.complete(function(err, fields, files) {
          var options, uploaded;
          uploaded = files['upload[file]'];
          options = {
            title: fields['upload[title]'],
            email: fields['upload[email]'],
            file_path: uploaded.path,
            file_type: uploaded.type
          };
          return split(options);
        });
      }
      return res.redirect('/');
    });
    server.post('/categorize', function(req, res) {
      if (req.form) {
        return req.form.complete(function(err, fields) {
          var category, segment_id, task_id;
          category = fields['categorize[content]'];
          task_id = fields['categorize[task_id]'];
          segment_id = fields['categorize[segment_id]'];
          Segment.findById(segment_id, function(err, segment) {
            segment.mode = category;
            segment.save(dbchecker);
            return create_transcribe_task(segment);
          });
          dormouse.answerTask(task_id, {
            mode: category
          }, function(err, r) {
            if (err) throw new Error('Error answering categorize dormouse task');
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
          var segment_id, task_id, transcription;
          transcription = fields['transcribe[content]'];
          task_id = fields['transcribe[task_id]'];
          segment_id = fields['transcribe[segment_id]'];
          record_transcription(segment_id, transcription);
          dormouse.answerTask(task_id, {
            transcription: transcription
          }, function(err, r) {
            if (err) throw new Error('Error answering transcribe dormouse task');
          });
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
            var j, s_completed;
            j = {};
            j.title = journal.title;
            j._id = journal._id;
            j.segments = segments.filter(function(s) {
              return String(journal._id) === String(s.journal_id);
            });
            s_completed = j.segments.filter(function(s) {
              return s.completed;
            });
            j.progress = Math.ceil(s_completed.length / j.segments.length * 100);
            j.completed = journal.completed;
            j.email = journal.email;
            j.numdone = s_completed.length;
            j.numsegments = j.segments.length;
            if (j.completed) {
              j.searchable = journal.searchable;
              j.transcribed = journal.transcribed;
            }
            return j;
          });
          return res.render('status.jade', {
            journals: context
          });
        });
      });
    });
    server.get('/complete', function(req, res) {
      var p;
      p = url.parse(req.url, true);
      if (p.query['journal_id'] != null) {
        return Journal.findById(p.query['journal_id'], function(err, journal) {
          if (journal.completed) {
            return res.render('complete.jade', {
              journal: journal
            });
          } else {
            return finalize_journal(journal_id, function(j) {
              return res.render('complete.jade', {
                journal: j
              });
            });
          }
        });
      } else {
        return res.render('complete.jade', {
          journal: false
        });
      }
    });
    io = io.listen(server);
    io.configure('production', function() {
      io.enable('browser client minification');
      io.enable('browser client etag');
      io.enable('browser client gzip');
      return io.set('log level', 1);
    });
    return io.sockets.on('connection', function(socket) {
      return socket.on('news', function(data) {
        return console.log(data);
      });
    });
  };

  record_transcription = function(s_id, t) {
    return Segment.findById(s_id, function(err, s) {
      s.transcription = t;
      s.completed = true;
      io.sockets.emit('updatesegment', s);
      return s.save(function(err) {
        return Segment.find({
          'journal_id': s.journal_id
        }, function(err, ss) {
          var alldone;
          alldone = ss.every(function(seg) {
            return seg.completed;
          });
          if (alldone) return finalize_journal(seg.journal_id);
        });
      });
    });
  };

  finalize_journal = function(j_id, cb) {
    return Journal.findById(j_id, function(err, journal) {
      return join(journal, function(out) {
        if ((out.transcribed != null) && (out.searchable != null)) {
          journal.completed = true;
          journal.transcribed = utils.fsPathToUrl(out.transcribed);
          journal.searchable = utils.fsPathToUrl(out.searchable);
          return journal.save(function(err) {
            notify_finalized(journal);
            if (cb) return cb(journal);
          });
        }
      });
    });
  };

  notify_finalized = function(journal) {
    var config, email;
    config = {
      to: journal.email,
      subject: "You're journal transcription is complete!",
      body: "You can access the searchable version of your journal at " + journal.searchable + " .\nThe transcribed version can be found at " + journal.transcribed + " .\n\nPowered by http://journal.dormou.se"
    };
    email = require('./email');
    return email.send_mail(config);
  };

  accepted_types = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png'
  };

  split = function(ops) {
    var journal, type;
    if (!(ops.file_type in accepted_types)) return fs.unlink(ops.file_path);
    journal = new Journal({
      title: ops.title,
      email: ops.email,
      file_path: ops.file_path
    });
    journal.save(dbchecker);
    type = accepted_types[ops.file_type];
    return json_spawn('./py_packages/bin/python', ['pdeff/split.py', type], journal.file_path, [], save_segments_to_db.bind(this, journal));
  };

  exports.accepted_types = accepted_types;

  exports.split = split;

  save_segments_to_db = function(journal, segments) {
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
      name: "categorize " + segment._id,
      project_id: dormouse.project_id,
      template_id: 2,
      parameters: {
        segment_url: segment.url,
        segment_id: segment._id
      }
    };
    return dormouse.createTask(task_info, function(err, r) {
      if (err) throw new Error('Error creating categorize dormouse task');
    });
  };

  create_transcribe_task = function(segment) {
    var task_info;
    task_info = {
      name: "transcribe " + segment._id,
      project_id: dormouse.project_id,
      template_id: 1,
      parameters: {
        segment_url: segment.url,
        mode: segment.mode,
        segment_id: segment._id
      }
    };
    return dormouse.createTask(task_info, function(err, r) {
      if (err) throw new Error('Error creating transcribe dormouse task');
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
      return json_spawn('./py_packages/bin/python', ['pdeff/join.py'], input, {}, cb);
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
