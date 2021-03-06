
fs = require 'fs'
path = require 'path'

dormouse = require 'dormouse'

task_template_map =
  1: path.resolve __dirname, '../static/templates/transcribe.html'
  2: path.resolve __dirname, '../static/templates/categorize.html'

task_submit_map =
  1: '/transcribe'
  2: '/categorize'

exports.fetch_render_task = (access_token, callback) ->
  q = dormouse.getTasks()
  q.authenticate access_token if access_token
  q.iscomplete false
  q.order_by '?'
  q.limit 1
  q.run (err, tasks) ->
    if err or not tasks.length
      callback 'No matching tasks were found', null
    else
      task = tasks[0]
      t_fname = task_template_map[task.template_id]
      fs.readFile t_fname, (err, template) ->
        rendered = dormouse.render template.toString(), task
        callback null, html: rendered, submit: task_submit_map[task.template_id]

exports.fetch_render_task_for_id = (task_id, access_token, callback) ->
  options = {}
  options['access_token'] = access_token if access_token
  dormouse.getTask task_id, options, (err, task) ->
    if err or not task
      callback "No matching task #{task_id} was found", null
    else
      t_fname = task_template_map[task.template_id]
      fs.readFile t_fname, (err, template) ->
        rendered = dormouse.render template.toString(), task
        callback null, html: rendered
