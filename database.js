'use strict';

var sqlite3 = require('sqlite3').verbose();
var db      = new sqlite3.Database('hirebot.db');
var q       = require('q')
var logger  = require('winston')

db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS users(' +
    'id INTEGER NOT NULL,' +
    'access_token VARCHAR(255) NOT NULL,' +
    'name VARCHAR(255) NOT NULL DEFAULT "",' +
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
})

var newUserQuery = 'INSERT OR REPLACE INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'
var newMailQuery = 'INSERT OR REPLACE INTO useremails VALUES(?,?,?,?)'
var userQuery    = 'SELECT * FROM users WHERE id = ?'
var newRepoQuery = 'INSERT INTO repositories(userid, name, url) VALUES(?,?,?)'
var repositoryQuery = 'SELECT * FROM repositories WHERE userid = ?'
var setLastAnalyzedCommit  = 'UPDATE repositories SET last_analyzed_commit = ?, lastcheck = CURRENT_TIMESTAMP WHERE userid = ? AND name = ?'
var addExperienceQuery = 'INSERT INTO statistics VALUES(?,?,?,?,?,?)'
var mailQuery = 'SELECT email FROM useremails WHERE userid = ?'
var analysisRepoQuery = 'SELECT * FROM repositories WHERE (julianday(CURRENT_TIMESTAMP) - julianday(lastcheck))*86400.0 > 360'
var allDeveloperQuery = 'SELECT * FROM users WHERE is_recruiter = 0'

exports.saveUser = function(user) {
  var deferred = q.defer()

  if (!user.avatar_url) user.avatar_url = "http://placehold.it/250x300"

  db.run(newUserQuery, user.id, user.access_token, user.name, user.profileurl, user.avatar_url, user.location, user.bio,
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

exports.addExperienceBulk = function(experiences) {
  var d = q.defer()

  db.run("BEGIN TRANSACTION")
  experiences.forEach(function(experience) {
    db.run(addExperienceQuery, experience.userid, experience.repo, experience.commit, experience.date.toISOString(), experience.language, experience.lines)
  })
  db.run("END", function(e,r) {
    if (e) d.reject(e)
    else d.resolve()
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
  var d = q.defer()
  db.all(allDeveloperQuery, function(e,r) {
    if (e) d.reject(e)
    else d.resolve(r)
  })
  return d.promise
}