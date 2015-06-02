'use strict';

var gapi = require('./githubapi.js')
var q    = require('q')
var git  = require('nodegit')
var config = require('./config.js')
var logger = require('winston')
var database = require('./database.js')
var _ = require('lodash')
var path = require('path')

exports.fetchNew = function(user) {
  var d = q.defer()
  var promises = [
    gapi.acquireUserRepositories(user),
    database.getRepositoriesFrom(user.id),
    user.id
  ]

  q.all(promises)
   .then(deselectKnownRepositories)
   .then(processNewRepositories)
   .then(d.resolve)

 return d.promise
}

function deselectKnownRepositories(repos) {
  var allRepos   = repos[0]
  var knownRepos = _.map(repos[1], 'name')

  for (var i = allRepos.length - 1; i >= 0; i--) {
    if (allRepos[i].name in knownRepos) {
      delete allRepos[i]
    }
  }

  return {
    unknownRepositories: allRepos,
    userid: repos[2]
  }
}

function processNewRepositories(data) {
  var deferred = q.defer()
  var repos = data.unknownRepositories
  var promises = []
  var formattedRepos = []

  for (var i = 0, j = repos.length - 1; i <= j; i++) {
    var fr = {
      userid: data.userid,
      name: repos[i].name,
      url: repos[i].html_url
    }

    repos[i].userid = data.userid

    promises.push(processSingleRepository(repos[i]))
    promises.push(database.addRepository(fr))
    formattedRepos.push(fr)
  }

  q.all(promises)
   .then(function() {
    logger.info('cloned', repos.length, 'repositories')
    deferred.resolve(formattedRepos)
  })
   .catch(logger.error)

  return deferred.promise
}

function processSingleRepository(repo) {
  var d = q.defer()
  var where = path.join(config.repositoryFolder, String(repo.userid), repo.name)

  git.Clone(repo.clone_url, where)
    .then(d.resolve)
    .catch(d.reject)

  return d.promise
}