'use strict';

var logger = require('winston')
var api    = require('./api.js')
var pages  = require('./pages.js')

exports.initialize = function(app, passport) {
  app.get('/', pages.renderIndex)

  app.get('/register', passport.authenticate('github'))
  app.get('/register/callback', passport.authenticate('github', { successRedirect: '/', failureRedirect: '/' }))

  app.route('/api/repositories')
    .all(isLoggedIn)
    .get(api.getRepositories)

  app.route('/api/statistics')
    .all(isLoggedIn)
    .get(api.getStatistics)
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.status(401).send()
  }
}