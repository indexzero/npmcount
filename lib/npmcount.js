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

      async.forEach(users, app.collect, callback);
    });
  });
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