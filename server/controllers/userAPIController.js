var User = require ('../models/user');
var jwt  = require('jwt-simple');
var config  = require('../config/database');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var bcrypt = require('bcrypt-nodejs');
var request = require('request');

var transport = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    secureConnection: false,
    auth: {
        user: '1412285.1412322.1412330.group@gmail.com',
        pass: 'kcoin1234'
    }
}));

exports.signup = function (req,res,next) {
  if (!req.body.email || !req.body.password) {
      res.json({success: false, msg: 'Please pass email and password.'});
    } else {
      var newUser = new User();
	    newUser.email = req.body.email;
      newUser.password = newUser.encryptPassword(req.body.password);

      //getRealMoney(res, newUser);
      // save the user
      newUser.save(function(err, user) {
        if (err) {
          return res.json({success: false, msg: 'Email already exists.'});
        }
        var token = jwt.encode(user, config.secret);
        createAddress(res, user);

          SendVerificationMail(req,user);
          res.json({success: true, msg: 'A verification email has been sent to ' + user.email + '.'});

      });
    }
}

exports.signin = function (req,res,next) {
  console.log("req:", req.body.email);
  User.findOne({
    email: req.body.email
  }, function(err, user) {
    console.log('email signin: ', req.body.email);
    if (err) throw err;

    if (!user) {
        console.log('User not found', req.body.email);
      res.send({success: false, msg: 'Authentication failed. User not found.'});
    } else {
      // check if password matches
      if (!user.validPassword(req.body.password)){
			     res.send({success: false, msg: 'Authentication failed. Wrong password.'});
		  }
      else{
        if (!user.isVerified)
         return res.json({ success: false, type: 'not-verified', msg: 'Your account has not been verified.' });

        // if user is found and password is right create a token
        var token = jwt.encode(user, config.secret);
        // return the information including token as JSON
        res.json({success: true, token: token, email: user.email});
      }

    }
  });
}

exports.profile = function (req,res,next) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      email: decoded.email
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          res.json({success: true, msg: 'Welcome in the member area ' + user.email + '!', email:  user.email, token: token});
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
}

exports.verify_email = function (req,res,next) {
  console.log(req.protocol+":/"+req.get('host'));
    User.findById(req.params.id).exec(function (err,user) {
        if(err){
            console.log(err);
            res.json({success: false, msg: err});

        }
        else
        {
            if (user != null && user !=undefined)
            {
                if (user.isVerified == true){
                    res.json({success: false, msg: 'Email ' + user.email + 'was verified!'});
                }
            }
            else
            {
                res.json({success: false, msg: 'User not found!'});
            }
        }
    });
    var user_instance = new User();
    user_instance._id = req.params.id;
    user_instance.isVerified = true;
    User.findByIdAndUpdate(req.params.id,user_instance,{}).exec(function (err,user) {
        if (err){
            res.json({success: false, msg: 'User not found!'});
        }
        else{
            var noti = "Your email "+user.email+" is verified";
            res.json({success: true, msg: noti});
        }
    });
}

exports.forget_password = function (req,res,next) {
  var email = req.body.email;
    User.findOne({'email': email}).exec(function(err, user)
    {
        if(err){
           res.json({success: false, msg: err});
        }
        if (user != null && user != undefined)
        {

            var noti = "Request has send to " + email;
            SendResetPasswordMail(req,user, res);                        //Send email reset password
            //res.json({success: true, msg: noti});

        }
        else
        {
          res.json({success: false, msg: "User not found!"});

        }
    });
}

exports.reset_password = function (req,res,next) {
  var reset_qr = req.body.reset;
    var id = req.params.id;
    console.log("id: "+id);
    console.log("Reset: "+reset_qr);

    var messages = [];
    if (reset_qr != null && reset_qr!=undefined && reset_qr != '' )             //check reset toke param
    {
        User.findById(id).exec(function (err, user) {                           //find user
            if (err) {
                console.log(err);
                res.json({success: false, msg: err});
            }
            else {
                if (user != null && user != undefined) {
                    console.log("Reset token: " + user.passwordResetToken);
                    if (user.passwordResetToken == reset_qr) {

                            var user_instance = new User();
                            user_instance._id = id;
                            user_instance.password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(5), null);
                            user_instance.passwordResetToken='';
                            user_instance.isVerified = true;
                            User.findByIdAndUpdate(id, user_instance, {}).exec(function (err, user) {
                                console.log(user);
                                if (user != null && user != undefined) {
                                  res.json({success: true, msg: 'Reset password successed!'});
                                }
                                else {
                                    res.json({success: false, msg: 'Reset password failed!'});
                                }
                            });

                    }
                    else {
                      res.json({success: false, msg: 'Link is expired!'});
                    }
                }
            }

        });
    }
    else
    {
      res.json({success: false, msg: "Reset token does not exists!"});
    }
}
getToken = function (headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization;
    if (parted) {
      return parted;
    } else {
      return null;
    }
  } else {
    return null;
  }
};

SendVerificationMail = function (req,user) {
    var host=req.get('host');
    var link="http://"+req.get('host')+"/api/users/verify/"+user["_id"];
    var mailOptions={
        to : user["email"],
        subject : "Please confirm your account",
        html : "Hello,<br> Please Click on the link to verify your email.<br><a href="+link+">Click here to verify</a>"
    }
    console.log(mailOptions);
    transport.sendMail((mailOptions),function(error, response){
        if(error){
            console.log(error);
            //res.end("error");
           // return false;
        }
        else{
            console.log("Message sent: " + response.message);
            console.log("success");
            //res.end("sent");
            //return true;
        }
    });
};

SendResetPasswordMail = function (req,user, res) {
    var token = bcrypt.hashSync(user["_id"], bcrypt.genSaltSync(5), null);
    User.findByIdAndUpdate(user["_id"],{_id: user["_id"], passwordResetToken: token}).exec(function (err,user) {
        if(err)
        {
            res.json({success: false, msg: err});
        }
        console.log("USER: " + user);
    });


    var host=req.get('host');
    //link này sẽ được thay thế bằng link tới form nhập password mới
    var link="http://"+req.get('host')+"/api/users/resetpassword/"+user["_id"]+"?reset="+token;              //link to reset password
    var mailOptions={
        to : user["email"],
        subject : "Reset your password",
        html : "Hello,<br> Please Click on the link to reset your password.<br><a href="+link+">Click here to reset your password</a>"
    }
    console.log(mailOptions);
    transport.sendMail(mailOptions, function(error, response){
        if(error){
            res.json({success: false, msg: "Reset token does not exists!"});
        }
        else{
            console.log("Message sent: " + response.message);
            res.json({success: true, resetToken: token, userID: user["_id"]});
        }
    });
};

createAddress =  function (res, user)
{

  var headers, options;
  headers = {
    'User-Agent':       'Super Agent/0.0.1',
    'Content-Type':     'application/x-www-form-urlencoded'
  }

  // Configure the request
  options = {
    url: 'https://api.kcoin.club/generate-address',
    method: 'GET',
    headers: headers
  }

  // Start the request
  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
    //  res.json(JSON.parse(body));
    console.log('address - createAddress - JSON: ', JSON.parse(body).address);
    user.address = JSON.parse(body).address;
    user.publicKey = JSON.parse(body).publicKey;
    user.privateKey = JSON.parse(body).privateKey;
    var user_instance = new User();
    user_instance._id = user._id;
    user_instance.address = JSON.parse(body).address;
    user_instance.publicKey = JSON.parse(body).publicKey;
    user_instance.privateKey = JSON.parse(body).privateKey;
    User.findByIdAndUpdate(user._id,user_instance,{}).exec(function (err,user) {
        if (err){
            res.json({success: false, msg: 'Create address error!'});
        }
    });
    } else {
      console.log(error);
    }
  });
}

getRealMoney =  function (res, user)
{

  var headers, options;
  headers = {
    'User-Agent':       'Super Agent/0.0.1',
    'Content-Type':     'application/x-www-form-urlencoded'
  }

  // Configure the request
  options = {
    url: 'https://api.instagram.com/v1/media/'+ req.params.id + '?access_token=3119388937.e029fea.9b82067145684be6a2f47acf50086e8a',
    method: 'GET',
    headers: headers
  }

  // Start the request
  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      res.json(JSON.parse(body));
    } else {
      console.log(error);
    }
  });
}
