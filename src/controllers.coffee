
exports.configure = (server) ->

  server.set 'view options', layout: false

  server.get '/', (req, res) ->
    res.render 'index.jade'

  server.post '/upload', (req, res) ->
    if req.form
      req.form.oncomplete = (err, fields, files) ->
        title = fields['upload[title]']
        console.log files
        journal = files[0]
      res.render 'status.jade'
    else
      res.render 'status.jade', error: 'Upload malfunction'

  server.get '/status', (req, res) ->
    res.render 'status.jade'
