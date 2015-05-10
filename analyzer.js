'use strict';

var repositories = require('./repositoryfetching.js')

process.on('message', function(m) {
  switch(m.type) {
    case 'newUser': repositories.fetchNew(m.user); return
  }
})