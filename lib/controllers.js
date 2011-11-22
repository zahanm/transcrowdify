
  exports.configure = function(server) {
    server.set('view options', {
      layout: false
    });
    server.get('/', function(req, res) {
      return res.render('index.jade');
    });
    return server.post('/upload', function(req, res) {
      return res.render('status.jade');
    });
  };
