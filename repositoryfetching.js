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
  var promises = [
    gapi.acquireUserRepositories(user),
    database.getRepositoriesFrom(user.id)
  ]

  q.all(promises)
   .then(deselectKnownRepositories)
   .then(processNewRepositories)
}

function deselectKnownRepositories(repos) {
  var allRepos   = repos[0]
  var knownRepos = _.map(repos[1], 'name')

  for (var i = allRepos.length - 1; i >= 0; i--) {
    if (allRepos[i].name in knownRepos) {
      delete allRepos[i]
    }
  }

  return allRepos
}

function processNewRepositories(repos) {
  var deferred = q.defer()
  var promises = []

  for (var i = 1, j = repos.length - 1; i <= 1; i++) {
    promises.push(processSingleRepository(repos[i]))
    promises.push(database.addRepository({
      userid: repos[i].owner.id,
      name: repos[i].name,
      url: repos[i].html_url,
    }))
  }

  q.all(promises)
   .then(deferred.resolve)
   .catch(logger.error)

  return deferred.promise
}

function processSingleRepository(repo) {
  var d = q.defer()
  var where = path.join(config.repositoryFolder, String(repo.owner.id), repo.name)
try{
  git.Clone(repo.clone_url, where)
    .then(function(repoHandle) {
      repoHandle.getMasterCommit()
        .then(function(c) {
          database.updateRepositoryHead({
            name: repo.name,
            userid: repo.owner.id,
            head: c.sha()
          })
        })
        .catch(logger.error)
    })
    .then(d.resolve)
    .catch(d.reject)
}catch(e){logger.error(e)}
  return d.promise
}