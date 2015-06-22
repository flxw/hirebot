'use strict';

var database = require('./database.js')
var logger = require('winston')
var q = require('q')

exports.renderIndex = function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.is_recruiter) {
      renderRecruiterPage(req,res)
    } else {
      renderUserpage(req, res)
    }
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
  var promises = [
    database.getRepositoriesFrom(req.user.id),
    database.getStatistics(req.user.id)
  ]

  q.all(promises).then(function() {
    res.render('authorized-user-index', {
      user: req.user,
      repositories: promises[0],
      statistics: promises[1]
    })
  })
}

function renderRecruiterPage(req,res) {

}