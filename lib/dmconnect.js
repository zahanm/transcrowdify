(function() {
  var dormouse, fs, path, task_submit_map, task_template_map;

  fs = require('fs');

  path = require('path');

  dormouse = require('dormouse');

  task_template_map = {
    1: path.resolve(__dirname, '../static/templates/transcribe.html'),
    2: path.resolve(__dirname, '../static/templates/categorize.html')
  };

  task_submit_map = {
    1: '/transcribe',
    2: '/categorize'
  };

  exports.fetch_render_task = function(access_token, callback) {
    var q;
    q = dormouse.getTasks();
    if (access_token) q.authenticate(access_token);
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
          return callback(null, {
            html: rendered,
            submit: task_submit_map[task.template_id]
          });
        });
      }
    });
  };

  exports.fetch_render_task_for_id = function(task_id, access_token, callback) {
    var options;
    options = {};
    if (access_token) options['access_token'] = access_token;
    return dormouse.getTask(task_id, options, function(err, task) {
      var t_fname;
      if (err || !task) {
        return callback("No matching task " + task_id + " was found", null);
      } else {
        t_fname = task_template_map[task.template_id];
        return fs.readFile(t_fname, function(err, template) {
          var rendered;
          rendered = dormouse.render(template.toString(), task);
          return callback(null, {
            html: rendered
          });
        });
      }
    });
  };

}).call(this);
