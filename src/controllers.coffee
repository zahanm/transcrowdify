
exports.configure = (server) ->

  server.set 'view options', layout: false

  server.get '/', (req, res) ->
    res.render 'index.jade'

  server.post '/upload', (req, res) ->
    res.render 'status.jade'
