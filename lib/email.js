(function() {
  var ImapConnection, MailParser, cmd, cmds, controllers, fs, gen_random_fname, get_message, imap, next, nodemailer, path, project_email, project_pw, setup_parser;

  fs = require('fs');

  path = require('path');

  nodemailer = require('nodemailer');

  ImapConnection = require('imap').ImapConnection;

  MailParser = require("mailparser").MailParser;

  controllers = require('./controllers');

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
        console.info('Inbox empty');
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
        console.info('Done fetching all messages');
        return next(null, msg_ids);
      });
    }, function(msg_ids) {
      return imap.addFlags(msg_ids, 'Seen', next);
    }, function() {
      console.info('Done seeing messages, now logging out');
      return imap.logout(next);
    }
  ];

  setup_parser = function() {
    var attach_fname, attach_type, disk_fname, mailparser;
    mailparser = new MailParser({
      streamAttachments: true
    });
    disk_fname = attach_fname = attach_type = null;
    mailparser.on('attachment', function(attachment) {
      var ext, output, rand_fname;
      if (attachment.contentType in controllers.accepted_types) {
        attach_type = attachment.contentType;
        attach_fname = attachment.generatedFileName;
        disk_fname = path.resolve(__dirname, '../uploads/', attach_fname);
        if (path.existsSync(disk_fname)) {
          ext = path.extname(attach_fname);
          rand_fname = gen_random_fname(ext);
          disk_fname = path.resolve(__dirname, '../uploads', rand_fname);
        }
        output = fs.createWriteStream(fname);
        return attachment.stream.pipe(output);
      }
    });
    mailparser.on('end', function(mail) {
      var options;
      if (attach_fname && disk_fname) {
        options = {
          title: mail.subject,
          email: mail.from[0].address,
          file_path: disk_fname,
          file_type: attach_type
        };
        console.info('Splitting the journal');
        return controllers.split(options);
      }
    });
    return mailparser;
  };

  get_message = function(msg) {
    var mailparser;
    console.info('We have a new email!');
    mailparser = setup_parser();
    msg.on('data', function(chunk) {
      return mailparser.write(chunk);
    });
    return msg.on('end', function() {
      return mailparser.end();
    });
  };

  exports.check_mail = function() {
    console.info('Checking email');
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
    console.info("Sending email to " + to);
    config.sender = project_email;
    return nodemailer.send_mail(config, function(err, success) {
      return console.info('Message ' + (success ? 'sent' : 'failed'));
    });
  };

  gen_random_fname = function(ext) {
    var name, now;
    now = new Date();
    name = [now.getYear(), now.getMonth(), now.getDay(), '-', process.pid, '-', (Math.random() * 0x100000000 + 1).toString(36), ext].join('');
    return name;
  };

}).call(this);
