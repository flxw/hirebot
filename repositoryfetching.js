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
    database.getRepositoriesFrom(user.id)
  ]

  q.all(promises)
   .then(deselectKnownRepositories)
   .then(processNewRepositories)
   .then(d.resolve)
   .catch(d.reject)

 return d.promise
}

function deselectKnownRepositories(repos) {
  var allRepos   = repos[0]
  var knownRepos = _.map(repos[1], 'name')

  var r = _.filter(allRepos, function(rp) {
    return !_.contains(knownRepos, rp.name)
  })

  return r
}

function processNewRepositories(repos) {
  var deferred = q.defer()
  var promises = []
  var formattedRepos = []

  for (var i = 0, j = repos.length - 1; i <= j; i++) {
    var fr = {
      userid: repos[i].owner.id,
      name: repos[i].name,
      url: repos[i].html_url
    }

    promises.push(processSingleRepository(repos[i]))
    promises.push(database.addRepository(fr))
    formattedRepos.push(fr)
  }

  q.all(promises)
   .then(function() {
     logger.info('cloned', repos.length, 'repositories')
     deferred.resolve(formattedRepos)
   })
   .catch(function(e) {
     debugger;
     logger.error(e)
   })

  return deferred.promise
}

function processSingleRepository(repo) {
  var d = q.defer()
  var where = path.join(config.repositoryFolder, String(repo.owner.id), repo.name)

  git.Clone(repo.clone_url, where)
    .then(d.resolve)
    .catch(d.reject)

  return d.promise
}