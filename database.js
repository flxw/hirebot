var sqlite3 = require('sqlite3').verbose();
var db      = new sqlite3.Database('hirebot.db');
var q       = require('q')
var format  = require('string-format')

db.serialize(function() {
  db.run('CREATE TABLE IF NOT EXISTS users(id VARCHAR(255) NOT NULL, access_token VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
  db.run('CREATE TABLE IF NOT EXISTS useremails(userid VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, FOREIGN KEY(userid) REFERENCES users(id))')
})

var newUserQuery = 'INSERT OR REPLACE INTO users VALUES("{id}"," {access_token}")'
var newMailQuery = 'INSERT OR REPLACE INTO useremails VALUES("{id}"," {email}")'

exports.saveUser = function(user) {
  var deferred = q.defer()

  db.run(format(newUserQuery, user))

  for (var i = user.emails.length - 1; i >= 0; i--) {
    db.run(format(newMailQuery,{id: user.id, email: user.emails[i]}))
  }

  deferred.resolve()

  return deferred.promise
}