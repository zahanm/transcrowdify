(function() {
  var ImapConnection, MailParser, allowed_types, cmd, cmds, controllers, fs, get_message, imap, mailparser, next, nodemailer, project_email, project_pw, utils,
    __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  fs = require('fs');

  nodemailer = require('nodemailer');

  ImapConnection = require('imap').ImapConnection;

  MailParser = require("mailparser").MailParser;

  controllers = require('./controllers');

  utils = require('./utils');

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

  mailparser = new MailParser({
    streamAttachments: true
  });

  mailparser.on('attachment', function(attachment) {
    var fname, output;
    fname = utils.normedPathJoin(__dirname, '../uploads/', attachment.generatedFileName);
    output = fs.createWriteStream(fname);
    return attachment.stream.pipe(output);
  });

  allowed_types = ['application/pdf'];

  mailparser.on('end', function(mail) {
    var a, attachment, fname, options, _i, _len, _ref, _ref2;
    attachment = null;
    _ref = mail.attachments;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      a = _ref[_i];
      if (_ref2 = a.contentType, __indexOf.call(allowed_types, _ref2) >= 0) {
        attachment = a;
      }
    }
    if (attachment) {
      fname = utils.normedPathJoin(__dirname, '../uploads/', attachment.generatedFileName);
      options = {
        title: mail.subject,
        email: mail.from[0].address,
        file_path: fname,
        file_type: attachment.contentType
      };
      console.log('Splitting the journal');
      return controllers.split(options);
    }
  });

  get_message = function(msg) {
    console.log('We have a new email!');
    msg.on('data', function(chunk) {
      return mailparser.write(chunk);
    });
    return msg.on('end', function() {
      return mailparser.end();
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
