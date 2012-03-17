(function() {
  var Journal, Segment, accepted_types, create_categorize_task, create_transcribe_task, dbchecker, dmconnect, dormouse, finalize_journal, fs, io, join, json_spawn, mongoose, notify_finalized, record_transcription, save_segments_to_db, spawn, split, utils,
    __hasProp = Object.prototype.hasOwnProperty;

  spawn = require('child_process').spawn;

  fs = require('fs');

  mongoose = require('mongoose');

  io = require('socket.io');

  dormouse = require('dormouse');

  dmconnect = require('./dmconnect');

  utils = require('./utils');

  Journal = mongoose.model('Journal');

  Segment = mongoose.model('Segment');

  exports.configure = function(server) {
    server.set('view options', {
      layout: false
    });
    css.root = '/styles';
    server.get('/', function(req, res) {
      var context;
      context = {
        'user': null,
        'task': null
      };
      if (req.session.access_token) {
        context['user'] = req.session.user;
        context['logout_url'] = dormouse.logout_url(req.headers.host);
        return dmconnect.fetch_render_task(req.session.access_token, function(err, task) {
          if (err) console.error(err);
          context['task'] = task;
          return res.render('index.jade', context);
        });
      } else {
        context['login_url'] = dormouse.login_url(req.headers.host);
        context['signup_url'] = dormouse.signup_url(req.headers.host);
        return res.render('index.jade', context);
      }
    });
    server.get('/task', function(req, res) {
      var context;
      context = {
        'task': null
      };
      if (req.query['task_id'] != null) {
        return dmconnect.fetch_render_task_for_id(req.query['task_id'], null, function(err, task) {
          if (err) console.error(err);
          context['task'] = task;
          return res.render('task.jade', context);
        });
      } else {
        return res.render('task.jade', context);
      }
    });
    server.get('/checkemail', function(req, res) {
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
          return res.redirect("/");
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
          return res.redirect("/");
        });
      } else {
        return res.redirect('/');
      }
    });
    server.get('/status', function(req, res) {
      var email;
      email = require('./email');
      email.check_mail();
      return Segment.find(function(err, segments) {
        return Journal.find(function(err, journals) {
          journals.forEach(function(j) {
            var s_completed;
            j.segments = segments.filter(function(s) {
              return String(j._id) === String(s.journal_id);
            });
            s_completed = j.segments.filter(function(s) {
              return s.completed;
            });
            j.progress = Math.ceil(s_completed.length / j.segments.length * 100);
            j.numdone = s_completed.length;
            return j.numsegments = j.segments.length;
          });
          return res.render('status.jade', {
            journals: journals
          });
        });
      });
    });
    server.get('/complete', function(req, res) {
      if (req.query['journal_id'] != null) {
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
    dormouse.setup_auth(server);
    io = io.listen(server);
    return io.configure('production', function() {
      io.enable('browser client minification');
      io.enable('browser client etag');
      io.enable('browser client gzip');
      return io.set('log level', 1);
    });
  };

  record_transcription = function(s_id, t) {
    return Segment.findById(s_id, function(err, seg) {
      seg.transcription = t;
      seg.completed = true;
      io.sockets.emit('updatesegment', seg);
      return seg.save(function(err) {
        return Segment.find({
          'journal_id': seg.journal_id
        }, function(err, segs) {
          var alldone;
          alldone = segs.every(function(s) {
            return s.completed;
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
    io.sockets.emit('completejournal', journal);
    config = {
      to: journal.email,
      subject: "You're journal transcription is complete!",
      body: "You can access the searchable version of your journal at http://journal.dormou.se" + journal.searchable + " .\nThe transcribed version can be found at http://journal.dormou.se" + journal.transcribed + " .\n\nPowered by http://dormou.se"
    };
    email = require('./email');
    return email.send_mail(config);
  };

  accepted_types = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
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
    var context, k, v, _ref;
    context = {};
    context.segments = segments.map(function(seg, i) {
      var segment;
      segment = new Segment({
        file_path: seg.location,
        url: utils.fsPathToUrl(seg.location),
        page: seg.page,
        layout_order: i + 1,
        journal_id: journal._id
      });
      segment.save(function(err, saved) {
        return create_categorize_task(saved);
      });
      return segment;
    });
    _ref = journal._doc;
    for (k in _ref) {
      if (!__hasProp.call(_ref, k)) continue;
      v = _ref[k];
      context[k] = v;
    }
    return io.sockets.emit('newjournal', context);
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
      eligibility: {
        predicate: null,
        communities: ['mturk']
      },
      parameters: {
        segment_url: segment.url,
        mode: segment.mode,
        segment_id: segment._id,
        turk_title: "Transcribe Text",
        turk_description: "Please transcribe the text you see in the image.",
        turk_reward: 0.02,
        turk_url: "http://journal.dormou.se/task/"
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
