'use strict';

var logger = require('winston')
var api    = require('./api.js')
var pages  = require('./pages.js')

exports.initialize = function(app, passport) {
  app.get('/', pages.renderIndex)
  app.get('/javascript', isLoggedIn, pages.renderJsStatistics)

  app.get('/register', passport.authenticate('github'))
  app.get('/register/callback', passport.authenticate('github', { successRedirect: '/', failureRedirect: '/' }))
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.redirect('/')
  }
}