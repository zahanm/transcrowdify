
{spawn, exec} = require 'child_process'
fs = require 'fs'
path = require 'path'

coffeelib = 'src'
jslib = 'lib'

task 'compile', 'compile coffeescript to javascript', (options) ->
  invoke 'clean'
  compile_files()

task 'runserver', 'run the node server', (options) ->
  invoke 'clean'
  compile_files ->
    pkg_config = JSON.parse fs.readFileSync 'package.json'
    server = spawn 'node', [ pkg_config['main'] ]
    server.stdout.on 'data', (data) ->
      console.log strip data.toString()
    server.stderr.on 'data', (data) ->
      console.error strip data.toString()
    server.on 'exit', (code, signal) ->
      process.exit code

task 'clean', 'clean up assembled and built js', (options) ->
  files = fs.readdirSync jslib
  for file in files
    if '.js' is path.extname file
      fs.unlinkSync path.join jslib, file

#--- helper functions

compile_files = (cb) ->
  exec "coffee --compile --lint --output #{jslib} #{coffeelib}", (err, stdo, stde) ->
    if (err)
      console.error 'coffeescript compilation error', err.type
      console.error 'stderr', stde
      process.exit 1
    cb() if cb

strip = (s) ->
  return s.replace(/^\s*/, '').replace(/\s*$/, '')
