'use strict';

var sqlite3 = require('sqlite3').verbose();
var db      = new sqlite3.Database('hirebot.db');
var q       = require('q')
var logger  = require('winston')

db.serialize(function() {
  db.run('CREATE TABLE IF NOT EXISTS users(id INTEGER NOT NULL, access_token VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL DEFAULT "", profileurl VARCHAR(255) NOT NULL DEFAULT "", is_recruiter BOOLEAN NOT NULL, is_valid BOOLEAN NOT NULL, PRIMARY KEY(id))');
  db.run('CREATE TABLE IF NOT EXISTS useremails(userid INTEGER NOT NULL, email VARCHAR(255) NOT NULL, FOREIGN KEY(userid) REFERENCES users(id))')
  db.run('CREATE TABLE IF NOT EXISTS repositories(userid INTEGER NOT NULL, name VARCHAR(255) NOT NULL DEFAULT "", url VARCHAR(255) NOT NULL, lastcheck DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_analyzed_commit VARCHAR(255), FOREIGN KEY(userid) REFERENCES users(id))')
  db.run('CREATE TABLE IF NOT EXISTS statistics(userid INTEGER NOT NULL, reponame VARCHAR(255) NOT NULL, commitid VARCHAR(255) NOT NULL, language VARCHAR(255) NOT NULL, lines INTEGER NOT NULL, FOREIGN KEY(userid) REFERENCES users(id))')
})

var newUserQuery = 'INSERT OR REPLACE INTO users(id,access_token, name, profileurl, is_recruiter, is_valid) VALUES(?,?,?,?,?,?)'
var newMailQuery = 'INSERT OR REPLACE INTO useremails(userid,email) VALUES(?,?)'
var userQuery    = 'SELECT * FROM users WHERE id = ?'
var newRepoQuery = 'INSERT INTO repositories(userid, name, url) VALUES(?,?,?)'
var repositoryQuery = 'SELECT * FROM repositories WHERE userid = ?'
var setLastAnalyzedCommit  = 'UPDATE repositories SET last_analyzed_commit = ?, lastcheck = CURRENT_TIMESTAMP WHERE userid = ? AND name = ?'
var addExperienceQuery = 'INSERT INTO statistics VALUES(?,?,?,?,?)'
var mailQuery = 'SELECT email FROM useremails WHERE userid = ?'

exports.saveUser = function(user) {
  var deferred = q.defer()

  db.run(newUserQuery, user.id, user.access_token, user.name, user.profileurl, false, true, function(error) {
    if (error) deferred.reject(error)
    else deferred.resolve(user)
  })

  for (var i = user.emails.length - 1; i >= 0; i--) {
    db.run(newMailQuery, user.id, user.emails[i])
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

exports.addExperience = function(experience) {
  var d = q.defer()

  db.run(addExperienceQuery, experience.userid, experience.repo, experience.commit, experience.language, experience.lines, function(error) {
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