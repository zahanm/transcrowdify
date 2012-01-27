
// ### Status communication js
// Assumes prescence of jQuery lib and socket.io lib

(function() {

  var socket;
  socket = io.connect('http://localhost');

  socket.on('hello', function(data) {
    console.log(data);
    socket.emit('news', { like: 'there is any' });
  });

})(this);
