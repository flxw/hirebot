'use strict';

var q        = require('q')
var database = require('./database.js')
var _        = require('lodash')
var winston  = require('winston')
var fork     = require('child_process').fork
var gapi     = require('./githubapi.js')
var fs       = require('fs')
var path     = require('path')

winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {timestamp:true, colorize:true})

process.on('message', function(m) {
  switch(m.type) {
    case 'newUser':
      getRepositoriesFor(m.user).then(analyzeUserRepositories)
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
        .then(analyzeUserRepositories)
        .catch(log)
        .done(function() {
          log('scheduling analysis for in one hour')
          setTimeout(refreshAnalysis, 3600000)
        })
    })
}

// --- analyzer logic ---------------------------

function analyzeUserRepositories(repos) {
  var d = q.defer()
  var promises = []

  for (var i = repos.length - 1; i >= 0; i--) {
    if (!fs.existsSync(path.join(__dirname, String(repos[i].userid)))) {
      fs.mkdirSync(path.join(__dirname, String(repos[i].userid)))
    }

    for (var j = repos[i].knownRepositories.length - 1; j >= 0; j--) {
      var kr = repos[i].knownRepositories[j]
      promises.push(executeAnalyzerWorker(kr.userid, kr.name, kr.last_analyzed_commit))
    }

    for (var j = repos[i].unknownRepositories.length - 1; j >= 0; j--) {
      var ukr = repos[i].unknownRepositories[j]
      promises.push(executeAnalyzerWorker(repos[i].userid, ukr.name, null, ukr.html_url))
    }
  }

  q.all(promises).then(function() {
    d.resolve()
  }).progress(log)
    .catch(function(e) {
      log(e)
      d.reject()
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

  fork('./analyzer-worker.js', parameters, function(error,stdout,stderr) {
    if (error) {
      log('worker failed', error, stdout, stderr)
      d.reject(e)
    } else {
      d.notify('yo')
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
  var knownRepos   = _.map(repos[1], 'name')
  var unknownRepos = _.filter(allRepos, function(rp) {
    return !_.contains(knownRepos, rp.name)
  })

  return {
    unknownRepositories: unknownRepos,
    knownRepositories: knownRepos,
    userid: repos[2]
  }
}

function log() {
  winston.info('analyzer', _.map(arguments).join(' '))
}
