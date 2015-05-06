'use strict';

exports.initialize = function(app, accounting) {
  app.route('/')
    .get(function(req, res) {
      var file = '404.html'

      if (false /*req.isAuthenticated()*/) {
        file = 'authorized-index.html'
      } else {
        file = 'unauthorized-index.html'
      }

      res.sendFile(file, {root: './public'})
    })

  app.route('/register')
    .get(accounting.register)
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.status(401).send()
  }
}
