(function() {
  var divide, exec, spawn, _ref;

  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;

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
          var journal, title;
          title = fields['upload[title]'];
          journal = files['upload[file]'];
          return divide(journal, function(segments) {
            return console.log(segments);
          });
        });
        return res.render('status.jade', {
          errors: []
        });
      } else {
        return res.render('status.jade', {
          errors: ['Upload malfunction']
        });
      }
    });
    return server.get('/status', function(req, res) {
      return res.render('status.jade', {
        errors: []
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
    split.stdin.write(journal.path);
    return split.stdin.end();
  };

}).call(this);
