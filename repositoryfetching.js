'use strict';

var gapi = require('./githubapi.js')
var q    = require('q')
var git  = require('nodegit')
var config = require('./config.js')
var logger = require('winston')
var database = require('./database.js')

exports.fetch = function(user) {
  gapi.acquireUserRepositories(user)
    .then(cloneRepositories)
    .then(database.saveRepositories)
}

function cloneRepositories(repos) {
  var deferred = q.defer()
  var promises = []
  var clonedRepos = []

  for (var i = 0, j = repos.length - 1; i <= j; i++) {
    var r = repos[i]
    var where = config.repositoryFolder + r.owner.id + '-' + r.name

    promises.push(git.Clone(r.clone_url, where))
    clonedRepos.push({
      name: r.name,
      userid: r.owner.id,
      url: r.html_url
    })
  }

  q.all(promises)
   .then(function(r) { logger.info('finished cloning ', repos.length); deferred.resolve(clonedRepos) })
   .catch(logger.error)

  return deferred.promise
}