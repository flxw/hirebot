'use strict';

var logger = require('winston')
var api    = require('./api.js')

exports.initialize = function(app, passport) {
  app.route('/')
    .get(function(req, res) {
      var file = '404.html'
      var data = {}

      if (req.isAuthenticated()) {
        data = { user: req.user }

        if (req.user.is_recruiter) {
          file = 'authorized-recruiter-index'
        } else {
          file = 'authorized-user-index'
          data.script = 'user.js'
        }
      } else {
        file = 'unauthorized-index'
      }

      res.render(file, data)
    })

  app.get('/register', passport.authenticate('github'))
  app.get('/register/callback', passport.authenticate('github', {
    successRedirect: '/',
    failureRedirect: '/'
  }))

  app.get('/api/repositories', api.getRepositories)
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.status(401).send()
  }
}
