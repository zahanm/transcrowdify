
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
          return journal = files['upload[file'];
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
