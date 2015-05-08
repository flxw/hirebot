'use strict';

var database = require('./database.js')

exports.getRepositories = function(req,res) { database.getRepositoriesFrom(req.user.id).then(function(repos) { res.json(repos).send() }) }