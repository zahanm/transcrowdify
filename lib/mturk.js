(function() {
  var Journal, Mongoose, Segment, dmconnect, dormouse;

  Mongoose = require('mongoose');

  dormouse = require('dormouse');

  dmconnect = require('./dmconnect');

  Journal = Mongoose.model('Journal');

  Segment = Mongoose.model('Segment');

  exports.check_responses = function(access_token) {
    return dormouse.refreshTurkResponses(function() {
      var q;
      q = dormouse.getTasks();
      q.authenticate(access_token);
      return Segment.find(function(err, segments) {
        return segments.forEach(function(segment) {
          return console.log(segment);
        });
      });
    });
  };

}).call(this);
