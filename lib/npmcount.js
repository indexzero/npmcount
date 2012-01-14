/*
 * npmcount.js: Top-level for npmcount module
 *
 * (C) 2011, Charlie Robbins.
 * MIT LICENSE
 *
 */
 
var flatiron = require('flatiron'),
    async = flatiron.common.async,
    npm = require('npm'),
    request = require('request'),
    npmout = require('npm/lib/utils/output');

//
// Export the application
//
var app = module.exports = flatiron.app;
    

//
// ### function loadnpm (callback)
// #### @callback {function} Continuation to respond to when complete
// Loads npm for the application.
//
app.loadnpm = function (callback) {
  //
  // Monkey patch `npmout.write()` so that we don't need log or out files
  //
  npmout.write = function () {
    var args = Array.prototype.slice.call(arguments),
        callback;

    args.forEach(function (arg) {
      if (typeof arg === 'function') {
        callback = arg;
      }
    });

    if (callback) {
      callback();
    }
  };
  
  app.emit('npm:load', 'Loading npm');
  npm.load({ outfd: null, exit: false }, callback);
};

//
// ### function count (users, callback) 
// #### @users {Array} List of users to count packages for
// #### @callback {function} Continuation to respond to when complete
//
app.count = function (users, callback) {
  //
  // Reset app.packages to be empty for the new count 
  //
  app.packages = {};
  app.init(function () {
    app.loadnpm(function (err) {
      if (err) {
        return callback(err);
      }

      async.forEach(users, app.collect, function (err) {
        if (err) {
          return callback(err);
        }
        
        app.github(callback);
      });
    });
  });
};

app.github = function (callback) {
  var packages = Object.keys(app.packages);
  
  async.forEach(packages, function (name, next) {
    var url = 'http://registry.npmjs.org/' + app.packages[name][0] + '/latest';
    app.emit('npm:get', url);
    request('http://registry.npmjs.org/' + app.packages[name][0] + '/latest', function (err, res, body) {
      var result = JSON.parse(body);
      if (result.error || !result.repository || !result.repository.url) {
        app.emit('github:error', 'warn', 'No repository for ' + app.packages[name][0]);
        app.packages[name].push('No repository found');
        return next();
      }
      
      var url = result.repository.url
        .replace(/.*\:\/\//, '')
        .replace('git@github.com:', '')
        .replace('.git', '')
        .split('/');
        
      url = 'http://github.com/api/v2/json/repos/show/' + url.slice(-2).join('/');
      app.emit('github:get', url);
      request(url, function (err, res, body) {
        var result = JSON.parse(body);
        app.packages[name].push(result.error ? 'No repository found' : result.repository.watchers);
        next();
      });
      
    });
  }, callback);
  
};

//
// ### function collect (user, callback)
// #### @user {string} Users to collect packages for into `app.packages`.
// #### @callback {function} Continuation to respond to when complete
// Collects the packages for `user` into `app.packages`.
//
app.collect = function (user, callback) {
  app.emit('npm:search', 'Searching npm', user);
  npm.commands.search(['=' + user], function (err, userPkgs) {
    if (err) {
      return callback(err);
    }
    
    var truncate = app.config.get('truncate') || 40;
    
    Object.keys(userPkgs).forEach(function (pkg) {
      var name = pkg.toLowerCase();
      if (!app.packages[name]) {
        app.packages[name] = [
          name,
          (userPkgs[pkg].description || 'No description').substr(0, truncate),
          userPkgs[pkg].maintainers.join(' ')
        ];
        
        if (app.packages[name][1].length === truncate) {
          app.packages[name][1] += '...  '
        }
      }
    });
    
    callback();
  });
}