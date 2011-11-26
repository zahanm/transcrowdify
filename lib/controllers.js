(function() {
  var Journal, Segment, dbchecker, divide, fs, join, mongoose, segment, spawn;

  spawn = require('child_process').spawn;

  fs = require('fs');

  mongoose = require('mongoose');

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
    var output, split;
    split = spawn('python', ['pdeff/split.py']);
    output = '';
    split.stdout.on('data', function(buffer) {
      return output += buffer.toString();
    });
    split.stderr.on('data', function(buffer) {
      return console.error(buffer.toString().trim());
    });
    split.on('exit', function(code) {
      if (code !== 0) cb([]);
      try {
        return cb(JSON.parse(output));
      } catch (err) {
        return cb([]);
      }
    });
    split.stdin.write(journal.file_path);
    return split.stdin.end();
  };

  join = function(cb) {
    if (cb) return cb('/images/loading.gif', '/images/loading.gif');
  };

  dbchecker = function(err) {
    if (err) throw new Error('Error saving model to db');
  };

}).call(this);
