'use strict';

var q        = require('q')
var database = require('./database.js')
var _        = require('lodash')
var winston  = require('winston')
var fork     = require('child_process').fork
var gapi     = require('./githubapi.js')

winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {timestamp:true, colorize:true})

process.on('message', function(m) {
  switch(m.type) {
    case 'newUser':
      //getRepositoriesFor(m.user).then(analyzeUserRepositories)
      break;
  }
})

refreshAnalysis()

function refreshAnalysis() {
  database.getAllDevelopers()
    .then(function(developers) {
      var promises = []

      for (var i = developers.length-1; i >= 0; --i) {
        promises.push(getRepositoriesFor(developers[i]))
      }

      q.all(promises)
        .then(function(r) { return _.flatten(r) })
        .then(analyzeUserRepositories)
        .catch(log)
        .done(function() {
          log('scheduling analysis for in one hour')
          setTimeout(refreshAnalysis, 3600000)
        })
    })
}

// --- analyzer logic ---------------------------

function analyzeUserRepositories(repos, d) {
  if (!d) d = q.defer()

  if (repos.length === 0) {
    return d.resolve()
  }

  executeAnalyzerWorker(repos[0].userid, repos[0].name, repos[0].last_analyzed_commit, repos[0].html_url)
    .done(function() {
      repos.splice(0,1)
      return analyzeUserRepositories(repos, d)
    })

  return d.promise
}

function executeAnalyzerWorker(userid, repositoryname, stopcommit, cloneurl) {
  var d = q.defer()
  var parameters = [
    '--user=' + userid,
    '--repository=' + repositoryname
  ]

  if (cloneurl) parameters.push('--cloneurl=' + cloneurl)
  else if (stopcommit) parameters.push('--stopcommit=' + stopcommit)

  var child = fork('./analyzer-worker.js', parameters, { execArgv: [/* '--debug-brk=41337' */] })

  child.on('exit', function(exitCode) {
    if (exitCode) {
      log('worker failed')
      d.resolve()
    } else {
      log('analyzed', userid, repositoryname)
      d.resolve()
    }
  })

  return d.promise
}

function getRepositoriesFor(user) {
  var d = q.defer()
  var promises = [
    gapi.acquireUserRepositories(user),
    database.getRepositoriesFrom(user.id),
    user.id
  ]

  q.all(promises)
    .then(filterIntoNewAndKnown)
    .then(d.resolve)
    .catch(d.reject)

  return d.promise
}

function filterIntoNewAndKnown(repos) {
  var allRepos     = repos[0]
  var knownRepoNames   = _.map(repos[1], 'name')
  var unknownRepos = _.filter(allRepos, function(rp) { return !_.contains(knownRepoNames, rp.name) })

  for (var i = unknownRepos.length-1; i >= 0; i--) {
    unknownRepos[i] = _.pick(unknownRepos[i], ['name', 'html_url'])
    unknownRepos[i].userid = repos[2]
  }

  // unknown repositories will be identifiable via the exclusive html_url attribute
  return repos[1].concat(unknownRepos)
}

function log() {
  winston.info('analyzer', _.map(arguments).join(' '))
}
