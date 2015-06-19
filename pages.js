'use strict';

var database = require('./database.js')
var logger = require('winston')


exports.renderIndex = function(req, res) {
  if (req.isAuthenticated()) {
    renderUserpage(req,res)
  } else {
    renderLandingpage(res)
  }
}

exports.renderJsStatistics = function(req,res) {
  database.getJsStatistics(req.user.id)
    .then(function(data) { debugger; res.render('javascript', { user:req.user, statistics: data }) })
}

function renderLandingpage(res) {
  database.getLandingpageStatistics()
    .then(function(r) {
      var renderParams = r[0]

      if (renderParams.daycount !== null) renderParams.daycount = renderParams.daycount.toFixed(2)

      res.render('unauthorized-index', renderParams)
    })
}

function renderUserpage(req,res) {
  var file, data = { user: req.user }

  if (req.user.is_recruiter) {
    file = 'authorized-recruiter-index'
  } else {
    file = 'authorized-user-index'
  }

  res.render(file, data)
}