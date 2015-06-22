'use strict';

var ng             = require('nodegit')
var path           = require('path')
var config         = require('./config.js')
var q              = require('q')
var database       = require('./database.js')
var languagedetect = require('language-detect')
var _              = require('lodash')
var winston        = require('winston')
var jscomplex      = require('escomplex-js')

var USERID, REPOSITORYNAME, CLONEURL, STOPCOMMIT

if (process.argv.length < 4) {
  process.exit(1)
}

for (var i = process.argv.length-1; i >= 2; --i) {
  var parts = process.argv[i].split('=')

  switch(parts[0]) {
    case '--user': USERID = parts[1]; break;
    case '--repository': REPOSITORYNAME = parts[1]; break;
    case '--cloneurl': CLONEURL = parts[1]; break;
    case '--stopcommit': STOPCOMMIT = parts[1]; break;
    default: console.log('bad arguments', process.argv); process.exit(2); break;
  }
}

var repositoryPath = path.resolve(__dirname, config.repositoryFolder, String(USERID), REPOSITORYNAME)

if (CLONEURL) {
  ng.Clone(CLONEURL, repositoryPath)
    .then(registerSuccessfulClone)
    .then(function (r) { return {rep: r, uid: USERID} })
    .then(gatherDataForAnalysis)
    .then(collectCommitsForAnalysis)
    .then(collectDiffs)
    .then(analyzeDiffs)
    .then(saveExperiences)
    .catch(log)
    .done(function() { process.exit(0) })
} else {
  ng.Repository.open(repositoryPath)
    .then(updateRepository)
    .then(function (r) { return {rep: r, uid: USERID, stopcommit: STOPCOMMIT} })
    .then(gatherDataForAnalysis)
    .then(collectCommitsForAnalysis)
    .then(collectDiffs)
    .then(analyzeDiffs)
    .then(saveExperiences)
    .catch(log)
    .done(function() { process.exit(0) })
}

function updateRepository(gitRepo) {
  var d = q.defer()

  gitRepo.fetchAll({
    credentials: function(url, userName) { return ng.Cred.sshKeyFromAgent(userName) },
    certificateCheck: function() { return 1 }
  }).then(function() { return gitRepo.mergeBranches('master', 'origin/master') })
    .then(function() { d.resolve(gitRepo) })
    .catch(d.reject)

  return d.promise
}

function getMostRecentCommitFromCurrentBranch(repo) {
  return repo.getCurrentBranch()
    .then(function(branch) {
      return repo.getBranchCommit(branch)
    })
}

function gatherDataForAnalysis(u) {
  var promises = [], d = q.defer()

  promises.push(database.getUserMailAddresses(u.uid))
  promises.push(getMostRecentCommitFromCurrentBranch(u.rep))

  q.all(promises).then(function() {
    database.setLastAnalyzedCommit({
      userid: USERID,
      name: REPOSITORYNAME,
      commit: promises[1].id().tostrS()
    })

    return d.resolve({
      mails: _.map(promises[0], 'email'),
      commit: promises[1],
      stopcommit: u.stopcommit,
      repo: u.rep
    })
  }).catch(d.reject)

  return d.promise
}

function collectCommitsForAnalysis(selectorData) {
  var d = q.defer()
  var history = selectorData.commit.history()
  var commitsForAnalysis = []

  history.on('end', function(commits) {
    for (var i = 0, j = commits.length - 1; i <= j; i++) {
      if (commits[i].id().tostrS() === selectorData.stopcommit) break

      if (_.includes(selectorData.mails, commits[i].author().email())) {
        commitsForAnalysis.push(commits[i])
      }
    }

    d.resolve(commitsForAnalysis)
    history = undefined
  })

  history.start()

  return d.promise
}

function collectDiffs(commitsForAnalysis) {
  var d = q.defer()
  var promises = []

  for (var i = 0, j = commitsForAnalysis.length; i < j; ++i) {
    promises.push(commitsForAnalysis[i].getDiff())
  }

  q.all(promises)
    .then(function() {
      for (var i = 0, j = promises.length; i < j; ++i) {
        promises[i] = {
          diff: promises[i],
          commit: commitsForAnalysis[i]
        }
      }

      d.resolve(promises)
    })
    .catch(d.reject)

  return d.promise
}

function analyzeDiffs(diffs) {
  var d = q.defer()
  var promises = []

  for (var i = 0, j = diffs.length; i < j; ++i) {
    promises.push(analyzeDiff(diffs[i]))
  }

  q.all(promises).then(function(results) {
    var experiences = { general: [], js: []}

    for (var i = 0, j = results.length; i < j; ++i) {
      experiences.general.push({
        languages: results[i].general,
        commit: diffs[i].commit.id().tostrS(),
        date: diffs[i].commit.date()
      })

      if (results[i].js) experiences.js.push(results[i].js)
    }

    experiences.js = _.flatten(experiences.js)

    d.resolve(experiences);
  })

  return d.promise
}

function analyzeDiff(diffData) {
  var deferred = q.defer()
  var fileNames = []
  var experienceFromThisCommit = {}
  var diffGroup = diffData.diff

  for (var i_diff = 0; i_diff < diffGroup.length; ++i_diff) {
    var patches = diffGroup[i_diff].patches()

    for (var i_patch = 0; i_patch < patches.length; ++i_patch) {
      var hunks = patches[i_patch].hunks()
      var newLines = 0
      var filename = patches[i_patch].newFile().path()

      for (var i_hunk = 0; i_hunk < hunks.length; ++i_hunk) {
        var hunkLines = hunks[i_hunk].lines()

        for (var i_line = 0; i_line < hunkLines.length; ++i_line) {
          if (hunkLines[i_line].newLineno() > 0) {
            newLines++
          }
        }
      }

      var language = languagedetect.filename(filename)
      if (language !== undefined) {
        if (language in experienceFromThisCommit) {
          experienceFromThisCommit[language] += newLines
        } else {
          experienceFromThisCommit[language] = newLines
        }

        if (language === 'JavaScript' && !_.includes(fileNames, filename)) {
          fileNames.push(filename)
        }
      }
    }
  }

  if (fileNames.length > 0) {
    var promises = []

    for (var i = 0, j = fileNames.length; i < j; i++) {
      promises.push(runJavascriptMetrics(fileNames[i], diffData.commit))
    }

    q.allSettled(promises).then(function (jsMetrics) {
      var doneJsMetrics = _.pluck(_.filter(jsMetrics, 'state', 'fulfilled'), 'value')

      if (doneJsMetrics.length) deferred.resolve({ general: experienceFromThisCommit, js: doneJsMetrics })
      else deferred.resolve({ general: experienceFromThisCommit })
    })
  } else {
    deferred.resolve({general: experienceFromThisCommit})
  }

  return deferred.promise
}

function runJavascriptMetrics(filePath, commit) {
  var d = q.defer()

  commit.getParents(1).then(function(parentCommit) {
    parentCommit = parentCommit[0]
    return commit.getEntry(filePath).then(function(commitEntry) {
      return parentCommit.getEntry(filePath).then(function(parentEntry) {
        return commitEntry.getBlob().then(function(commitBlob) {
          return parentEntry.getBlob().then(function(parentBlob) {
            var commitContent = commitBlob.toString()
            var parentContent = parentBlob.toString()

            // now run js-analyzer and save metrics somehow
            var commitMetrics = jscomplex.analyse(commitContent)
            var parentMetrics = jscomplex.analyse(parentContent)

            commitMetrics.dependencies = commitMetrics.dependencies.length
            parentMetrics.dependencies = parentMetrics.dependencies.length

            delete commitMetrics.functions
            delete parentMetrics.functions

            delete commitContent
            delete parentContent

            d.resolve({
              commit: commit.id().tostrS(),
              path: filePath,
              before: parentMetrics,
              after: commitMetrics
            })
          })
        })
      })
    })
  }).catch(d.reject)


  return d.promise
}

// NOTE if experiences seem to be missing,
// check that the email with which the commit
// was made, is actually listed on github
function saveExperiences(exp) {
  var d  = q.defer()
  var savepromises = []
  var experiences = []

  for (var i = exp.general.length - 1; i >= 0; i--) {
    var languages = Object.keys(exp.general[i].languages)

    for (var j = languages.length - 1; j >= 0; j--) {
      experiences.push({
        userid: USERID,
        repo: REPOSITORYNAME,
        commit: exp.general[i].commit,
        date: exp.general[i].date,
        language: languages[j],
        lines: exp.general[i].languages[languages[j]]
      })
    }
  }

  savepromises.push(database.addJsStatisticsBulk(exp.js, USERID, REPOSITORYNAME))
  savepromises.push(database.addExperienceBulk(experiences))

  q.all(savepromises).then(d.resolve).catch(d.reject)

  return d.promise
}

function registerSuccessfulClone(repo) {
  var d = q.defer()

  database.addRepository({
    userid: USERID,
    name: REPOSITORYNAME,
    url: CLONEURL
  }).then(function() { d.resolve(repo) })
    .catch(d.reject)

  return d.promise
}

function log() {
  winston.info('analyzer-worker', _.map(arguments).join(' '))
}
