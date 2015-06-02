'use strict';

var request = require('request')
var _       = require('lodash')
var logger  = require('winston')
var q       = require('q')

exports.acquireUserEmails = function(u) {
  var deferred = q.defer()

  makeAuthenticatedRequest({
    url: 'https://api.github.com/user/emails',
    qs: { access_token: u.access_token },
    json: true,
    headers: { 'User-Agent': 'hirebot-alpha' }
  }, function(body) {
      u.emails = body
      deferred.resolve(u)
  })

  return deferred.promise
}

exports.acquireUserRepositories = function(u) {
  var deferred = q.defer()

  makeAuthenticatedRequest({
    url: 'https://api.github.com/user/repos',
    qs: {
      access_token: u.access_token,
      type: 'all'
     },
    json: true,
    headers: {
      Accept: 'application/vnd.github.moondragon+json',
      'User-Agent': 'hirebot-alpha'
    }
  }, deferred.resolve)

  return deferred.promise
}

function makeAuthenticatedRequest(what,cb) {
  request.get(what, function(error, response, body) {
    if (error) {
      logger.error(error, what)
    } else if (response.statusCode !== 200) {
      // handle invalid access token somehow
      logger.error(body, what)
    } else {
      cb(body)
    }
  })
}