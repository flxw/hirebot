'use strict';

var config   = require('./config.js')
var logger   = require('winston')
var q        = require('q')
var database = require('./database.js')
var gapi     = require('./githubapi.js')
var GithubStrategy = require('passport-github').Strategy
var passport

exports.initialize = function(p) {
  passport = p

  // used to serialize the user for the session
  passport.serializeUser(function(user, done) {
    done(null, user.id)
  })

  // used to deserialize the user
  passport.deserializeUser(function(id, done) {
    database.getUserById(id)
      .then(function(user) { done(null, user) })
      .catch(function(err) { done(err, null) })
  })

  passport.use(new GithubStrategy({
    clientID    : config.clientId,
    clientSecret: config.clientSecret,
    callbackURL : config.callbackUrl
  }, function(token, tokenSecret, profile, done) {
    process.nextTick(function() {
      database.getUserById(profile.id)
        .then(function(user) {
          if (user) {
            return done(null, user)
          } else {
            gapi.acquireUserEmails({id: profile.id, name: profile._json.name, profileurl: profile.profileUrl, access_token: token})
              .then(database.saveUser)
              .then(function(u) { done(null,u) })
          }
        })
        .catch(done)
    })
  }))
}