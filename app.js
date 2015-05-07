'use strict';

var express  = require('express')
var app      = express()
var passport = require('passport')
var logger  = require('winston')

// connect middlewares
var morgan       = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser   = require('body-parser')
var session      = require('express-session')

// external modules
var swig         = require('swig')
var stylus       = require('stylus')
var config       = require('./config.js');
var routes       = require('./routes.js')
var accounting   = require('./accounting.js')
var path         = require('path')

// set up express
if (config.debug) app.use(morgan('dev'))

app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))

// required for passport
app.use(session({ secret: config.passportSecret, saveUninitialized: true, resave: true }))
app.use(passport.initialize())
app.use(passport.session())

// preprocessor setup
swig.setDefaults({ cache: false})
app.engine('html', swig.renderFile)
app.set('view engine', 'html')
app.set('view cache', true)
app.set('views', __dirname + '/views')
app.use(stylus.middleware(path.join(__dirname, 'public')))
app.use(express.static(__dirname + '/public'))


// set up ---------------------------------------
accounting.initialize(passport)
routes.initialize(app, passport)

// launch ---------------------------------------
app.listen(config.port);
console.log('The magic happens on port ' + config.port);