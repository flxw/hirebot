var sqlite3 = require('sqlite3').verbose();
var db      = new sqlite3.Database('hirebot.db');
var q       = require('q')

db.serialize(function() {
  db.run('CREATE TABLE IF NOT EXISTS users(id INTEGER NOT NULL, access_token VARCHAR(255) NOT NULL, is_recruiter BOOLEAN NOT NULL, PRIMARY KEY(id))');
  db.run('CREATE TABLE IF NOT EXISTS useremails(userid INTEGER NOT NULL, email VARCHAR(255) NOT NULL, FOREIGN KEY(userid) REFERENCES users(id))')
})

var newUserQuery = 'INSERT OR REPLACE INTO users(id,access_token, is_recruiter) VALUES(?,?, ?)'
var newMailQuery = 'INSERT OR REPLACE INTO useremails(userid,email) VALUES(?,?)'
var userQuery    = 'SELECT * FROM users WHERE id = ?'

exports.saveUser = function(user) {
  var deferred = q.defer()

  db.run(newUserQuery, user.id, user.access_token, false)

  for (var i = user.emails.length - 1; i >= 0; i--) {
    db.run(newMailQuery, user.id, user.emails[i])
  }

  deferred.resolve(user)

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