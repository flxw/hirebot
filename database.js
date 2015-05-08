'use strict';

var sqlite3 = require('sqlite3').verbose();
var db      = new sqlite3.Database('hirebot.db');
var q       = require('q')
var repos   = require('./repositoryfetching.js')

db.serialize(function() {
  db.run('CREATE TABLE IF NOT EXISTS users(id INTEGER NOT NULL, access_token VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL DEFAULT "", profileurl VARCHAR(255) NOT NULL DEFAULT "", is_recruiter BOOLEAN NOT NULL, is_valid BOOLEAN NOT NULL, PRIMARY KEY(id))');
  db.run('CREATE TABLE IF NOT EXISTS useremails(userid INTEGER NOT NULL, email VARCHAR(255) NOT NULL, FOREIGN KEY(userid) REFERENCES users(id))')
  db.run('CREATE TABLE IF NOT EXISTS repositories(userid INTEGER NOT NULL, name VARCHAR(255) NOT NULL DEFAULT "", url VARCHAR(255) NOT NULL, lastcheck DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(userid) REFERENCES users(id))')
})

var newUserQuery = 'INSERT OR REPLACE INTO users(id,access_token, name, profileurl, is_recruiter, is_valid) VALUES(?,?,?,?,?,?)'
var newMailQuery = 'INSERT OR REPLACE INTO useremails(userid,email) VALUES(?,?)'
var userQuery    = 'SELECT * FROM users WHERE id = ?'
var newRepoQuery = 'INSERT OR REPLACE INTO repositories(userid, name, url) VALUES(?,?,?)'
var repositoryQuery = 'SELECT * FROM repositories WHERE userid = ?'

exports.saveUser = function(user) {
  var deferred = q.defer()

  db.run(newUserQuery, user.id, user.access_token, user.name, user.profileurl, false, true)

  for (var i = user.emails.length - 1; i >= 0; i--) {
    db.run(newMailQuery, user.id, user.emails[i])
  }

  deferred.resolve(user)
  repos.fetch(user)

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

exports.saveRepositories = function(repos) {
  var deferred = q.defer()

  for (var i = repos.length - 1; i >= 0; i--) {
    var r = repos[i]
    db.run(newRepoQuery, r.userid, r.name, r.url)
  }

  return deferred.promsie
}

exports.getRepositoriesFrom = function(user) {
  var deferred = q.defer()
  db.all(repositoryQuery, user, function(err,rows) {
    if (err) deferred.reject(err)
    else deferred.resolve(rows)
  })
  return deferred.promise
}