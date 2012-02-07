
$dm.server 'http://journal.dormou.se:8080'
$dm.api_key '5e60e715dff55d0ad0f4d807d1cc6dd6d1d044c3' # XXX should not be used
$dm.project_id 1 # transcrowdify
template_urls =
  1: '/templates/transcribe.html' # zahanm/transcribe.template
  2: '/templates/categorize.html' # zahanm/categorize.template
$(document).ready ->
  q = $dm.getTasks()
  q.iscomplete false
  q.order_by '?'
  q.limit 1
  q.run (err, tasks) ->
    if err or not tasks.length
      $('#loading').hide()
      return $('#nothing').show()
    task = tasks[0]
    $.get template_urls[task.template_id], (snippet) ->
      rendered = $dm.render snippet, task
      $('#task').html rendered
