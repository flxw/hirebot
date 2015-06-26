'use strict';

var sqlite3 = require('sqlite3').verbose();
var db      = new sqlite3.Database('hirebot.db');
var q       = require('q')
var logger  = require('winston')
var combinatorics = require('js-combinatorics')
var _ = require('lodash')

db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS users(' +
      'id INTEGER NOT NULL,' +
      'access_token VARCHAR(255) NOT NULL,' +
      'name VARCHAR(255) NOT NULL DEFAULT "",' +
      'profilename VARCHAR(255) NOT NULL,' +
      'profileurl VARCHAR(255) NOT NULL DEFAULT "",' +
      'avatarurl VARCHAR(255) NOT NULL DEFAULT "http://placehold.it/250x300",' +
      'location VARCHAR(255),' +
      'bio VARCHAR(255),' +
      'hireable BOOLEAN NOT NULL,' +
      'followers INTEGER NOT NULL,' +
      'following INTEGER NOT NULL,' +
      'is_recruiter BOOLEAN NOT NULL,' +
      'is_valid BOOLEAN NOT NULL,' +
      'PRIMARY KEY(id))');

    db.run('CREATE TABLE IF NOT EXISTS useremails(' +
      'userid INTEGER NOT NULL,' +
      'email VARCHAR(255) NOT NULL,' +
      'prime BOOLEAN NOT NULL,' +
      'verified BOOLEAN NOT NULL,' +
      'FOREIGN KEY(userid) REFERENCES users(id))')

    db.run('CREATE TABLE IF NOT EXISTS repositories(' +
      'userid INTEGER NOT NULL,' +
      'name VARCHAR(255) NOT NULL DEFAULT "",' +
      'url VARCHAR(255) NOT NULL, ' +
      'lastcheck DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
      'last_analyzed_commit VARCHAR(255),' +
      'FOREIGN KEY(userid) REFERENCES users(id))')

    db.run('CREATE TABLE IF NOT EXISTS statistics(' +
      'userid INTEGER NOT NULL,' +
      'reponame VARCHAR(255) NOT NULL,' +
      'commitid VARCHAR(255) NOT NULL,' +
      'date DATETIME NOT NULL,' +
      'language VARCHAR(255) NOT NULL,' +
      'lines INTEGER NOT NULL,' +
      'PRIMARY KEY(userid,reponame,commitid,language),' +
      'FOREIGN KEY(userid) REFERENCES users(id))')

    db.run('CREATE TABLE IF NOT EXISTS jsstatistics(' +
      'userid INTEGER NOT NULL,' +
      'reponame VARCHAR(255) NOT NULL,' +
      'commitid VARCHAR(255) NOT NULL,' +
      'filename VARCHAR(255) NOT NULL,' +
      'maintainability_before INTEGER NOT NULL,' +
      'maintainability_after INTEGER NOT NULL,' +
      'dependencies_before INTEGER NOT NULL,' +
      'dependencies_after INTEGER NOT NULL,' +
      'physical_sloc_before INTEGER NOT NULL,' +
      'physical_sloc_after INTEGER NOT NULL,' +
      'logical_sloc_before INTEGER NOT NULL,' +
      'logical_sloc_after INTEGER NOT NULL,' +
      'cyclomatic_complexity_before INTEGER NOT NULL,' +
      'cyclomatic_complexity_after INTEGER NOT NULL,' +
      'halstead_vocabulary_before INTEGER NOT NULL,' +
      'halstead_vocabulary_after INTEGER NOT NULL,' +
      'halstead_difficulty_before INTEGER NOT NULL,' +
      'halstead_difficulty_after INTEGER NOT NULL,' +
      'halstead_volume_before INTEGER NOT NULL,' +
      'halstead_volume_after INTEGER NOT NULL,' +
      'halstead_effort_before INTEGER NOT NULL,' +
      'halstead_effort_after INTEGER NOT NULL,' +
      'halstead_bugs_before INTEGER NOT NULL,' +
      'halstead_bugs_after INTEGER NOT NULL,' +
      'halstead_time_before INTEGER NOT NULL,' +
      'halstead_time_after INTEGER NOT NULL,' +
      'PRIMARY KEY(userid,reponame,commitid,filename),' +
      'FOREIGN KEY(userid) REFERENCES users(id))')

    db.run('CREATE VIEW IF NOT EXISTS calculatedmetric AS ' +
      'SELECT userid, language, MIN(date) AS firstcommitdate, MAX(date) AS lastcommitdate, SUM(lines) AS linecount,' +
      'COUNT(commitid) AS commitcount, julianday(MAX(date)) - julianday(MIN(date)) AS timespan,' +
      'SUM(lines)/COUNT(commitid) AS averagecommitsize,' +
      '(julianday(MAX(date)) - julianday(MIN(date)))/COUNT(commitid) AS productivity ' +
      'FROM statistics GROUP BY userid, language ' +
      'HAVING MIN(date) <> MAX(date) ' +
      'ORDER BY userid, timespan DESC, productivity ASC')

    db.run('CREATE VIEW IF NOT EXISTS processedjsstatistics AS ' +
      'SELECT userid, reponame, commitid,filename,' +
      'CAST(logical_sloc_after AS REAL)/CAST(physical_sloc_after AS REAL) AS pl_ratio, 100 - 100*(CAST(logical_sloc_after AS REAL)/CAST(physical_sloc_after AS REAL))/(CAST(logical_sloc_before AS REAL)/CAST(physical_sloc_before AS REAL)) AS pl_ratio_change,' +
      'maintainability_after, 100 - maintainability_before/maintainability_after*100 AS maintainability_change,' +
      'halstead_difficulty_after, 100 - 100*halstead_difficulty_before/halstead_difficulty_after AS halstead_difficulty_change,'+
      'halstead_volume_after, 100 - 100*halstead_volume_before/halstead_volume_after AS halstead_volume_change '+
      'FROM jsstatistics'
    )
})

var newUserQuery = 'INSERT OR REPLACE INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)'
var newMailQuery = 'INSERT OR REPLACE INTO useremails VALUES(?,?,?,?)'
var userQuery    = 'SELECT * FROM users WHERE id = ?'
var newRepoQuery = 'INSERT INTO repositories(userid, name, url) VALUES(?,?,?)'
var repositoryQuery = 'SELECT * FROM repositories WHERE userid = ?'
var setLastAnalyzedCommit  = 'UPDATE repositories SET last_analyzed_commit = ?, lastcheck = CURRENT_TIMESTAMP WHERE userid = ? AND name = ?'
var addExperienceQuery = 'INSERT INTO statistics VALUES(?,?,?,?,?,?)'
var addJsStatisticsQuery = 'INSERT INTO jsstatistics VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
var mailQuery = 'SELECT email FROM useremails WHERE userid = ?'
var analysisRepoQuery = 'SELECT * FROM repositories WHERE (julianday(CURRENT_TIMESTAMP) - julianday(lastcheck))*86400.0 > 720'
var allDeveloperQuery = 'SELECT * FROM users WHERE is_recruiter = 0'
var landingpageStatisticsQuery = 'SELECT COUNT(DISTINCT commitid) AS commitcount, COUNT(DISTINCT language) AS languagecount, julianday() - julianday(MIN(date)) AS daycount FROM statistics'
var personalDataQuery = 'SELECT * FROM calculatedmetric WHERE userid = ? ORDER BY linecount DESC'
var personalJsDataQuery = 'SELECT * FROM processedjsstatistics WHERE userid = ? ORDER BY halstead_difficulty_change DESC'
var languagesQuery = "SELECT DISTINCT language FROM calculatedmetric ORDER BY language ASC"

exports.saveUser = function(user) {
  var deferred = q.defer()

  if (!user.avatar_url) user.avatar_url = "http://placehold.it/250x300"

  db.run(newUserQuery, user.id, user.access_token, user.name, user.login,
    user.html_url, user.avatar_url, user.location, user.bio,
    user.hireable, user.followers, user.following, false, true,
    function (error) {
      if (error) deferred.reject(error)
      else deferred.resolve(user)
    }
  )

  for (var i = user.emails.length - 1; i >= 0; i--) {
    var mail = user.emails[i]
    db.run(newMailQuery, user.id, mail.email, mail.primary, mail.verified)
  }

  return deferred.promise
}

exports.getUserById = function(id) {
  var deferred = q.defer()

  db.get(userQuery, id, function(err, row) {
    if (err) deferred.reject(err)
    else deferred.resolve(row)
  })

  return deferred.promise
}

exports.addRepository = function(repo) {
  var deferred = q.defer()

  db.run(newRepoQuery, repo.userid, repo.name, repo.url, function(error) {
    if (error) deferred.reject(error)
    else deferred.resolve()
  })

  return deferred.promise
}

exports.setLastAnalyzedCommit = function(repo) {
  var d = q.defer()

  db.run(setLastAnalyzedCommit, repo.commit, repo.userid, repo.name, function(error) {
    if (error) d.reject(error)
    else d.resolve()
  })

  return d.promise
}

exports.addJsStatisticsBulk = function(bulk, uid, reponame) {
  var d = q.defer()

  db.serialize(function() {
    db.run("BEGIN TRANSACTION")
    bulk.forEach(function (e) {
      db.run(addJsStatisticsQuery,
        uid, reponame, e.commit, e.path,
        e.before.maintainability, e.after.maintainability,
        e.before.dependencies, e.after.dependencies,
        e.before.aggregate.sloc.physical, e.after.aggregate.sloc.physical,
        e.before.aggregate.sloc.logical, e.after.aggregate.sloc.logical,
        e.before.aggregate.cyclomatic, e.after.aggregate.cyclomatic,
        e.before.aggregate.halstead.vocabulary, e.after.aggregate.halstead.vocabulary,
        e.before.aggregate.halstead.difficulty, e.after.aggregate.halstead.difficulty,
        e.before.aggregate.halstead.volume, e.after.aggregate.halstead.volume,
        e.before.aggregate.halstead.effort, e.after.aggregate.halstead.effort,
        e.before.aggregate.halstead.bugs, e.after.aggregate.halstead.bugs,
        e.before.aggregate.halstead.time, e.after.aggregate.halstead.time
      )
    })
    db.run("END TRANSACTION", function (e, r) {
      if (e) d.reject(e)
      else d.resolve()
    })
  })

  return d.promise
}

exports.addExperienceBulk = function(experiences) {
  var d = q.defer()

  db.serialize(function() {
    db.run("BEGIN TRANSACTION")
    experiences.forEach(function (experience) {
      db.run(addExperienceQuery, experience.userid, experience.repo, experience.commit, experience.date.toISOString(), experience.language, experience.lines)
    })
    db.run("END TRANSACTION", function (e, r) {
      if (e) d.reject(e)
      else d.resolve()
    })
  })

  return d.promise
}

exports.addExperience = function(experience) {
  var d = q.defer()

    db.run(addExperienceQuery, experience.userid, experience.repo, experience.commit, experience.date.toISOString(), experience.language, experience.lines, function (error) {
    if (error) d.reject(error)
    else d.resolve()
  })

  return d.promise
}

exports.getRepositoriesFrom = function(user) {
  var deferred = q.defer()

  db.all(repositoryQuery, user, function(err,rows) {
    if (err) deferred.reject(err)
    else deferred.resolve(rows)
  })

  return deferred.promise
}

exports.getUserMailAddresses = function(uid) {
  var d = q.defer()

  db.all(mailQuery, uid, function(err,rows) {
    if (err) d.reject(err)
    else d.resolve(rows)
  })

  return d.promise
}

exports.getRepositoriesForAnalysis = function() {
  var d = q.defer()
  db.all(analysisRepoQuery, function(e,r) {
    if (e) d.reject(e)
    else d.resolve(r)
  })
  return d.promise
}

exports.getAllDevelopers = function() {
  return allRows(allDeveloperQuery)
}

exports.getLandingpageStatistics = function() {
  return allRows(landingpageStatisticsQuery)
}

exports.getStatistics = function(userid) {
  var d = q.defer()
  db.all(personalDataQuery, userid, function(e,r) {
    if (e) d.reject(e)
    else d.resolve(r)
  })
  return d.promise
}

exports.getJsStatistics = function(uid) {
  var d = q.defer()

  db.all(personalJsDataQuery, uid, function(e,r) {
    if (e) d.reject(e)
    else d.resolve(r)
  })

  return d.promise
}

exports.getRankingFor = function(languages, minDuration) {
  var d = q.defer()
  var lowerBound = Math.ceil(languages.length / 2)
  var queries = []

  for (var m = languages.length; lowerBound <= m; --m) {
    var combinations = combinatorics.combination(languages, m).toArray()
    var havingInclusive = ""

    for (var i = 0; i < combinations.length; ++i) {
      var query = "SELECT id,profilename,name,profileurl,avatarurl,location,hireable,followers,following FROM users u WHERE "
      var notCombinations = _.difference(languages, combinations[i])
      var conditions = ""

      for (var j = 0; j < combinations[i].length; ++j) {
        conditions += " '" + combinations[i][j] + "' "
        conditions += " IN (SELECT language FROM calculatedmetric WHERE userid = u.id AND timespan >= 360*" + minDuration + ") "
        if (j !== combinations[i].length - 1) conditions += " AND "
      }

      for (var j = 0; j < notCombinations.length; ++j) {
        conditions += " AND NOT '" + notCombinations + "' "
        conditions += " IN (SELECT language FROM calculatedmetric WHERE userid = u.id AND timespan >= 360*" + minDuration + ") "
      }

      queries.push({ langs: combinations[i], q: query + conditions })
    }
  }

  var promises = []
  for (var i = 0; i < queries.length; ++i) {
    promises.push(allRows(queries[i].q))
  }

  q.all(promises).then(function() {
    for (var i = 0; i < promises.length; ++i) {
      queries[i].users = promises[i]
      promises[i] = enrichUsers(queries[i].users)
    }

    return q.all(promises)
  }).then(function() {
    for (var i = 0; i < promises.length; ++i) {
      queries[i]. users = promises[i]
    }

    d.resolve(queries)
  }).catch(console.log)

  return d.promise
}

exports.getLanguages = function() {
  return allRows(languagesQuery)
}

function enrichUsers(uq) {
  var d = q.defer(),
      promises = []

  for (var i_uq = 0; i_uq < uq.length; ++i_uq) {
    promises.push(enrichUser(uq[i_uq]))
  }

  q.all(promises).then(d.resolve)

  return d.promise
}

function enrichUser(u) {
  var d = q.defer()

  allRows("SELECT * FROM calculatedmetric WHERE userid = " + u.id)
    .then(function(rows) {
      u.skills = rows
      delete u.id

      d.resolve(u)
    })

  return d.promise
}

function allRows(query) {
  var d = q.defer()
  db.all(query, function(e,r) {
    if (e) d.reject({error:e, query: query})
    else d.resolve(r)
  })
  return d.promise
}
