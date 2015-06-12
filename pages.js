'use strict';

var database = require('./database.js')


exports.renderIndex = function(req, res) {
  if (req.isAuthenticated()) {
    renderUserpage(req,res)
  } else {
    renderLandingpage(res)
  }
}

function renderLandingpage(res) {
  database.getLandingpageStatistitcs().then(function(r) { res.render('unauthorized-index', r[0]) })
}

function renderUserpage(req,res) {
  var file, data = { user: req.user }

  if (req.user.is_recruiter) {
    file = 'authorized-recruiter-index'
  } else {
    file = 'authorized-user-index'
    data.script = 'user.js'
  }

  res.render(file, data)
}
