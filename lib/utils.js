(function() {
  var CountDownLatch, path;

  path = require('path');

  exports.randomChoice = function(seq) {
    var k, r;
    if (seq instanceof Array) {
      r = Math.floor(Math.random() * seq.length);
      k = r;
    } else {
      k = random_choice(Object.keys(seq));
    }
    return seq[k];
  };

  exports.fsPathToUrl = function(p) {
    var starter;
    starter = p.indexOf('static');
    return p.slice(starter + 'static'.length);
  };

  CountDownLatch = (function() {

    function CountDownLatch(count, finished) {
      this.count = count;
      this.finished = finished;
    }

    CountDownLatch.prototype.countDown = function() {
      if (!(this.count > 0)) throw new Error('Countdown is already done');
      this.count -= 1;
      if (this.count === 0) return this.Finished();
    };

    return CountDownLatch;

  })();

  exports.CountDownLatch = CountDownLatch;

}).call(this);
