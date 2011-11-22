
  exports.configure = function(server) {
    server.set('view options', {
      layout: false
    });
    server.get('/', function(req, res) {
      return res.render('index.jade');
    });
    server.post('/upload', function(req, res) {
      if (req.form) {
        req.form.oncomplete = function(err, fields, files) {
          var journal, title;
          title = fields['upload[title]'];
          console.log(files);
          return journal = files[0];
        };
        return res.render('status.jade');
      } else {
        return res.render('status.jade', {
          error: 'Upload malfunction'
        });
      }
    });
    return server.get('/status', function(req, res) {
      return res.render('status.jade');
    });
  };
