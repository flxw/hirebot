'use strict';

var config   = require('./config.js')
var request  = require('request')
var logger   = require('winston')
var q        = require('q')
var database = require('./database.js')
var _        = require('lodash')
var passport

exports.initialize = function(p) { passport = p }

exports.register = function(req,res) {
  var code = req.query.code

  acquireAccessToken(code)
    .then(acquireBasicUserInfo)
    .then(acquireUserEmails)
    .then(database.saveUser)
    .then(res.send)
    .catch(function(e) { logger.error(e) })
}

function acquireAccessToken(code) {
  var deferred = q.defer()

  request.post({
    url:'https://github.com/login/oauth/access_token',
    body: {
      code: code,
      client_secret: config.clientSecret,
      client_id: config.clientId
    },
    json: true,
    headers: { 'User-Agent': 'hirebot-alpha' }
  }, function(err,httpResponse,body){
    if (err) {
      logger.error(err)
      deferred.reject(err)
    } else {
      deferred.resolve(body.access_token)
    }
  })

  return deferred.promise
}

function acquireBasicUserInfo(token) {
  var deferred = q.defer()

  request.get({
    url: 'https://api.github.com/user',
    qs: { access_token: token },
    json: true,
    headers: { 'User-Agent': 'hirebot-alpha' }
  }, function(error, response, body) {
    if (error) {
      logger.error(error)
      deferred.reject(error)
    } else {
      deferred.resolve({
        id: body.login,
        access_token: token
      })
    }
  })

  return deferred.promise
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