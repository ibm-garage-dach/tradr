/*
       Copyright 2018 IBM Corp All Rights Reserved

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var proxy = require('express-http-proxy');

var routes = require('./routes/index');

var session = require('express-session')

var tokenGen = require('./jwt/token')

var passport = require('passport');

const WebAppStrategy = require('ibmcloud-appid').WebAppStrategy;

const APP_URL = process.env.APP_URL || "https://localhost:3000";
const CALLBACK_URL = "/tradr/auth/sso/callback";

passport.use(
    new WebAppStrategy({
        tenantId: process.env.APPID_TENANT_ID,
        clientId: process.env.APPID_CLIENT_ID,
        secret: process.env.APPID_SECRET,
        oauthServerUrl: process.env.APPID_OAUTH_SERVER_URL,
        redirectUri: APP_URL + CALLBACK_URL
    })
);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));


var app = express();

// view engine setup
app.set('view engine', 'jade')
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(session({resave: true, saveUninitialized: true , secret: 'keyboard cat', maxAge: 3600000}));
app.use(passport.initialize());
app.use(passport.session());

// Allow CORS
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


const ensureAuthenticated = passport.authenticate(WebAppStrategy.STRATEGY_NAME);

app.get('/tradr/user', ensureAuthenticated, function (req, res) {
    res.send({
        token: tokenGen.generateAccessToken({
            uniqueSecurityName: req.user.name,
            id: req.user.identities[0].id,
            name: req.user.name,
            given_name: req.user.given_name,
            family_name: req.user.family_name
        }),
        session: {
            user: {
                _json: {
                    name: req.user.name,
                    given_name: req.user.given_name,
                    family_name: req.user.family_name
                },
                refreshToken: req.session[WebAppStrategy.AUTH_CONTEXT].refreshToken,
                accessToken: req.session[WebAppStrategy.AUTH_CONTEXT].accessToken    
            }
        }
    });
    //res.send(req.session.passport);
});

app.get(CALLBACK_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME));

app.get('/tradr/hello', ensureAuthenticated, function (req, res) {
    console.log(req.user);
    res.send('Hello, ' + req.user.name + '!');
});

app.use('/tradr', ensureAuthenticated, express.static(path.join(__dirname, 'dist')));

app.use('/portfolio', proxy(process.env.PORTFOLIO_URL));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    console.log({
        message: err.message,
        error: {}
    });
});


module.exports = app;
