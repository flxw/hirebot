'use strict';

var logger = require('winston')

exports.initialize = function(app, passport) {
  app.route('/')
    .get(function(req, res) {
      var file = '404.html'

      if (req.isAuthenticated()) {
        if (req.user.is_recruiter) file = 'authorized-recruiter-index'
        else file = 'authorized-user-index'
      } else {
        file = 'unauthorized-index'
      }

      res.render(file)
    })

  app.get('/register', passport.authenticate('github'))
  app.get('/register/callback', passport.authenticate('github', {
    successRedirect: '/',
    failureRedirect: '/'
  }))
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.status(401).send()
  }
}
