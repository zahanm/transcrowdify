(function() {
  var ImapConnection, cmd, cmds, get_message, imap, next, nodemailer, project_email, project_pw;

  nodemailer = require('nodemailer');

  ImapConnection = require('imap').ImapConnection;

  project_email = 'journal@dormou.se';

  project_pw = '12qwas12';

  imap = new ImapConnection({
    username: project_email,
    password: project_pw,
    host: 'imap.gmail.com',
    port: 993,
    secure: true
  });

  cmd = 0;

  next = function(err) {
    if (err) {
      throw err;
    } else if (cmd < cmds.length) {
      return cmds[cmd++].apply(this, Array.prototype.slice.call(arguments).slice(1));
    }
  };

  cmds = [
    function() {
      return imap.connect(next);
    }, function() {
      return imap.openBox('INBOX', next);
    }, function(box) {
      return imap.search(['UNSEEN'], next);
    }, function(msg_ids) {
      var fetch;
      if (!msg_ids.length) {
        console.log('Inbox empty');
        return imap.logout;
      }
      fetch = imap.fetch(msg_ids, {
        request: {
          headers: false,
          body: 'full'
        }
      });
      fetch.on('message', get_message);
      return fetch.on('end', function() {
        console.log('Done fetching all messages');
        return next(null, msg_ids);
      });
    }, function(msg_ids) {
      return imap.addFlags(msg_ids, 'Seen', next);
    }, function() {
      console.log('Done seeing messages, now logging out');
      return imap.logout(next);
    }
  ];

  get_message = function(msg) {
    var raw_body;
    console.log('We have a new email!');
    raw_body = '';
    msg.on('data', function(chunk) {
      return raw_body += chunk;
    });
    return msg.on('end', function() {
      return console.log(raw_body);
    });
  };

  exports.check_mail = function() {
    console.log('Checking email');
    cmd = 0;
    return next();
  };

  nodemailer.SMTP = {
    host: 'smtp.gmail.com',
    port: 465,
    ssl: true,
    use_authentication: true,
    user: project_email,
    pass: project_pw
  };

  exports.send_mail = function(config) {
    console.log("Sending email to " + to);
    config.sender = project_email;
    return nodemailer.send_mail(config, function(err, success) {
      return console.log('Message ' + (success ? 'sent' : 'failed'));
    });
  };

}).call(this);
