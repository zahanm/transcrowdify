(function() {
  var dormouse, fs, path, task_template_map;

  fs = require('fs');

  path = require('path');

  dormouse = require('dormouse');

  task_template_map = {
    1: path.resolve(__dirname, '../static/templates/transcribe.html'),
    2: path.resolve(__dirname, '../static/templates/categorize.html')
  };

  exports.fetch_render_task = function(access_token, callback) {
    var q;
    q = dormouse.getTasks();
    q.authenticate(access_token);
    q.iscomplete(false);
    q.order_by('?');
    q.limit(1);
    return q.run(function(err, tasks) {
      var t_fname, task;
      if (err || !tasks.length) {
        return callback('No matching tasks were found', null);
      } else {
        task = tasks[0];
        t_fname = task_template_map[task.template_id];
        return fs.readFile(t_fname, function(err, template) {
          var rendered;
          rendered = dormouse.render(template.toString(), task);
          return callback(null, rendered);
        });
      }
    });
  };

}).call(this);
