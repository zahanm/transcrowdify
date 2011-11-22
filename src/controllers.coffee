
exports.configure = (server) ->

  server.set 'view options', layout: false

  server.get '/', (req, res) ->
    res.render 'index.jade'

  server.post '/upload', (req, res) ->
    if req.form
      req.form.complete (err, fields, files) ->
        title = fields['upload[title]']
        journal = files['upload[file']
      res.render 'status.jade', errors: []
    else
      res.render 'status.jade', errors: [ 'Upload malfunction' ]

  server.get '/status', (req, res) ->
    res.render 'status.jade', errors: []
