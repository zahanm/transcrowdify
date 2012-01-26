(function() {
  var nodemailer, project_email, project_pw;

  nodemailer = require('nodemailer');

  project_email = 'journal@dormou.se';

  project_pw = '12qwas12';

  exports.check_mail = function() {
    return console.log('Checking email');
  };

  nodemailer.SMTP = {
    host: 'smtp.gmail.com',
    port: 465,
    ssl: true,
    use_authentication: true,
    user: project_email,
    pass: project_pw
  };

  exports.send_mail = function(to, subject, body) {
    var config;
    console.debug("Sending email to " + to);
    config = {
      sender: project_email,
      to: to,
      subject: subject,
      body: body
    };
    return nodemailer.send_mail(config, function(err, success) {
      return console.debug('Message ' + (success ? 'sent' : 'failed'));
    });
  };

}).call(this);
