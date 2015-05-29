'use strict';

var repositories   = require('./repositoryfetching.js')
var ng             = require('nodegit')
var q              = require('q')
var path           = require('path')
var languagedetect = require('language-detect')
var database       = require('./database.js')
var config         = require('./config.js')
var _              = require('lodash')


process.on('message', function(m) {
  switch(m.type) {
    case 'newUser':
      repositories.fetchNew(m.user).then(analyzeRepositories)
      break;
  }
})

refreshAnalysis()

// --- analyzer logic ---------------------------

function analyzeRepositories(repos) {
  var d = q.defer()
  var promises = []

  for (var i = repos.length - 1; i >= 0; i--) {
    promises.push(analyzeRepository(repos[i]))
  }

  q.all(promises).then(function() {
    console.log('analyzed all repositories for', repos[0].userid)
    d.resolve()
  })

  return d.promise
}

function analyzeRepository(repo) {
  var d = q.defer()

  ng.Repository.open(path.resolve(__dirname, config.repositoryFolder, String(repo.userid), repo.name))
    .then(function(r) { return { rep: r, uid: repo.userid, stopcommit: repo.last_analyzed_commit } })
    .then(gatherDataForAnalysis)
    .then(collectCommitsForAnalysis)
    .then(collectDiffs)
    .then(analyzeDiffs)
    .then(function(experience) {
      if (experience.length !== 0) return saveExperiences(experience, repo.userid, repo.name)
    })
    .catch(console.log)
    .done(function() {
      console.log('finished analysis of repo', repo.name, 'from', repo.userid)
      d.resolve()
    })

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
    return d.resolve({
      mails: _.map(promises[0], 'email'),
      commit: promises[1],
      stopcommit: u.stopcommit
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
          commit: commitsForAnalysis[i].id().tostrS(),
          date: commitsForAnalysis[i].date()
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
    promises.push(analyzeDiff(diffs[i].diff))
  }

  q.all(promises).then(function(experiences) {
    for (var i = 0, j = experiences.length; i < j; ++i) {
      experiences[i] = {
        languages: experiences[i],
        commit: diffs[i].commit,
        date: diffs[i].date
      }
    }

    d.resolve(experiences);
  })

  return d.promise
}

function analyzeDiff(diffGroup) {
  var deferred = q.defer()
  var experienceFromThisCommit = {}

  for (var i_diff = 0; i_diff < diffGroup.length; ++i_diff) {
    var patches = diffGroup[i_diff].patches()

    for (var i_patch = 0; i_patch < patches.length; ++i_patch) {
      var file  = patches[i_patch].newFile().path()
      var hunks = patches[i_patch].hunks()
      var newLines = 0

      for (var i_hunk = 0; i_hunk < hunks.length; ++i_hunk) {
        var hunkLines = hunks[i_hunk].lines()

        for (var i_line = 0; i_line < hunkLines.length; ++i_line) {
          if (hunkLines[i_line].newLineno() > 0) {
            newLines++
          }
        }
      }

      var language = languagedetect.filename(file)
      if (language !== undefined) {
        if (language in experienceFromThisCommit) {
          experienceFromThisCommit[language] += newLines
        } else {
          experienceFromThisCommit[language] = newLines
        }
      }
    }
  }

  deferred.resolve(experienceFromThisCommit)

  return deferred.promise
}

function saveExperiences(exp, userid, reponame) {
  var d  = q.defer()

  for (var i = exp.length - 1; i >= 0; i--) {
    Object.keys(exp[i].languages).forEach(function(key) {
      database.addExperience({
        userid: this.uid,
        repo: this.rname,
        commit: this.e.commit,
        date: this.e.date,
        language: key,
        lines: this.e.languages[key]
      })
    }.bind({e: exp[i], uid: userid, rname: reponame}));
  }

  database.setLastAnalyzedCommit({
    userid: userid,
    name: reponame,
    commit: exp[0].commit
  })

  d.resolve()

  return d.promise
}

function updateRepositories(repositories) {
  var d = q.defer(), promises = []

  for (var i = repositories.length - 1; i >= 0; i--) {
    promises.push(updateRepository(repositories[i]))
  }

  q.allSettled(promises).then(function() {
    console.log('pulled all repositories!')
    d.resolve(repositories)
  })

  return d.promise
}

function updateRepository(r) {
  var d = q.defer(), gitRepo

  ng.Repository.open(path.resolve(__dirname, config.repositoryFolder, String(r.userid), r.name))
    .then(function(gr) {
      gitRepo = gr
      return gitRepo.fetchAll({
        credentials: function(url, userName) { return ng.Cred.sshKeyFromAgent(userName) },
        certificateCheck: function() { return 1 }
      })
    })
    .then(function() { return gitRepo.mergeBranches('master', 'origin/master') })
    .then(d.resolve)

  return d.promise
}

function refreshAnalysis() {
  database.getRepositoriesForAnalysis()
    .then(updateRepositories)
    .then(analyzeRepositories)
    .then(function() {
      console.log('scheduling analysis for in one hour')
      setTimeout(refreshAnalysis, 360000)
    })
 }