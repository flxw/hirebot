'use strict';

var database = require('./database.js')
var logger = require('winston')
var q = require('q')
var _ = require('lodash')

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
    .then(function(data) {
      res.render('javascript', { user:req.user, statistics: data })
    })
}

exports.renderRecruiting = function(req,res) {
  var promises = [
    database.getLanguages()
  ]

  if (req.query.criteria) {
    var langs = _.map(JSON.parse(req.query.criteria), 'language')
    promises.push(database.getRankingFor(langs))
  }

  q.all(promises).then(function(results) {
    if (results[1]) {
      results[1].forEach(function(cf) {
        cf.users.forEach(function(c) {
          c.skills.forEach(function(s) {
            s.timespan = s.timespan / 360
          })
        })
      })
    }

    res.render("recruiting", {
      languages: results[0],
      candidateFields: results[1]
    })
  })
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