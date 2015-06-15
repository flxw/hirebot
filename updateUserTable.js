'use strict';

var sqlite3 = require('sqlite3').verbose()
var db      = new sqlite3.Database('hirebot.db')
var q       = require('q')
var request = require('request')
var limiter = new (require('limiter').RateLimiter)(1, 'second')


db.serialize(function() {
  //db.run('ALTER TABLE users ADD COLUMN profilename VARCHAR(255)')

  db.each('SELECT * FROM users WHERE profilename = NULL OR profileurl = ""', function(error, user) {
    makeAuthenticatedRequest({
      url: 'https://api.github.com/user',
      qs: {
      access_token: user.access_token,
        type: 'all'
      },
      json: true,
        headers: {
        Accept: 'application/vnd.github.moondragon+json',
          'User-Agent': 'hirebot-alpha'
      }
    }, function(b) {
      db.run('UPDATE users SET profilename = ?, profileurl = ? WHERE id = ?', b.login, b.html_url, b.id)
    })
  })
})

function makeAuthenticatedRequest(what,cb) {
  limiter.removeTokens(1, function() {
    request.get(what, function (error, response, body) {
      if (error) {
        console.error(error, what)
      } else if (response.statusCode !== 200) {
        // handle invalid access token somehow
        console.error(body, what)
      } else {
        cb(body)
      }
    })
  })
}