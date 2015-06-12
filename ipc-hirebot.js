var fork = require('child_process').fork

var analyzer = null

exports.startAnalyzer = function() {
  analyzer = fork('analyzer.js')
}

exports.notifyOfNewUser = function(user) {
  analyzer.send({
    type: 'newUser',
    user: user
  })
}