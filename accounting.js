'use strict';

var config   = require('./config.js')
var request  = require('request')
var logger   = require('winston')
var q        = require('q')
var database = require('./database.js')
var _        = require('lodash')
var GithubStrategy = require('passport-github').Strategy
var passport

exports.initialize = function(p) {
  passport = p

  // used to serialize the user for the session
  passport.serializeUser(function(user, done) {
    logger.info('serialize')
    done(null, user.id)
  })

  // used to deserialize the user
  passport.deserializeUser(function(id, done) {
    logger.info('deserialize')
    database.getUserById(id)
      .then(function(user) { done(null, user) })
      .catch(function(err) { done(err, null) })
  })

  passport.use(new GithubStrategy({
    clientID    : config.clientId,
    clientSecret: config.clientSecret,
    callbackURL : config.callbackUrl
  }, function(token, tokenSecret, profile, done) {
    logger.info('authenticate')
    process.nextTick(function() {
      database.getUserById(profile.id)
        .then(function(user) {
          if (user) {
            return done(null, user)
          } else {
            acquireUserEmails({id: profile.id, access_token: token})
              .then(database.saveUser)
              .then(function(u) { done(null,u) })
          }
        })
        .catch(done)
    })
  }))
}

exports.register = function(req,res) {
  var code = req.query.code

  acquireAccessToken(code)
    .then(acquireBasicUserInfo)
    .then(acquireUserEmails)
    .then(database.saveUser)
    .then(res.send)
    .catch(function(e) { logger.error(e) })
}

function acquireUserEmails(u) {
  var deferred = q.defer()

  request.get({
    url: 'https://api.github.com/user/emails',
    qs: { access_token: u.access_token },
    json: true,
    headers: { 'User-Agent': 'hirebot-alpha' }
  }, function(error, response, body) {
    if (error) {
      logger.error(error)
      deferred.reject(error)
    } else {
      u.emails = _.map(body, 'email')
      deferred.resolve(u)
    }
  })

  return deferred.promise
}