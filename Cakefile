
{spawn, exec} = require 'child_process'
fs = require 'fs'
path = require 'path'

coffeelib = 'src'
jslib = 'lib'

task 'compile', 'compile coffeescript to javascript', (options) ->
  invoke 'clean'
  compile_files(false)

task 'runserver', 'run the node server', (options) ->
  invoke 'clean'
  compile_files true, ->
    pkg_config = JSON.parse fs.readFileSync 'package.json'
    server = spawn 'node', [ pkg_config['main'] ]
    server.stdout.on 'data', (data) ->
      console.log data.toString().trim()
    server.stderr.on 'data', (data) ->
      console.error data.toString().trim()
    server.on 'exit', (code, signal) ->
      process.exit code

task 'clean', 'clean up assembled and built js', (options) ->
  files = fs.readdirSync jslib
  for file in files
    if '.js' is path.extname file
      fs.unlinkSync path.join jslib, file

task 'docs', 'build docs for .coffee files using docco', (options) ->
  docco = spawn "docco #{coffeelib}/*.coffee"
  docco.stdout.on 'data', (data) ->
    console.log data.toString().trim()
  docco.stderr.on 'data', (data) ->
    console.log data.toString().trim()
  docco.on 'exit', (code, signal) ->
    process.exit code

#--- helper functions

compile_files = (watch, cb) ->
  exec "coffee --compile --lint --output #{jslib} #{coffeelib}", (err, stdo, stde) ->
    if (err)
      console.error 'coffeescript compilation error', err.type
      console.error 'stderr', stde
      process.exit 1
    cb() if cb
