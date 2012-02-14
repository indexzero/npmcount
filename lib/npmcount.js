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
  app.results = {};
  app.packages = {};
  app.followers = {};
  app.init(function () {
    app.loadnpm(function (err) {
      if (err) {
        return callback(err);
      }

      async.forEach(users, app.collect, function (err) {
        if (err) {
          return callback(err);
        }
        
        app.github(app.packages, callback);
      });
    });
  });
};

//
// ### function github (packages, callback)
// #### @packages {Array|Object} Set of packages to compute followers for
// #### @callback {function} Continuation to respond to when complete
//
app.github = function (packages, callback) {
  var names = Array.isArray(packages) 
    ? packages
    : Object.keys(packages);
  
  app.retry = [];
  async.forEach(names, function (name, next) {
    var url = 'http://registry.npmjs.org/' + name + '/latest';
    app.emit('npm:get', url);
    request('http://registry.npmjs.org/' + name + '/latest', function (err, res, body) {
      var result = app.packages[name] = JSON.parse(body);
      if (result.error || !result.repository || !result.repository.url) {
        app.emit('github:error', 'warn', 'No repository for ' + name);
        app.results[name].push('No repository found');
        return next();
      }
      else if (app.results[name].length === 4) {
        return next();
      }
      
      var url = result.repository.url
        .replace(/.*\:\/\//, '')
        .replace('git@github.com:', '')
        .replace('.git', '')
        .split('/')
        .concat(['watchers']);
        
      url = 'http://github.com/api/v2/json/repos/show/' + url.slice(-3).join('/');
      app.emit('github:get', url);
      request(url, function (err, res, body) {
        var watchers;
        
        try {
          watchers = JSON.parse(body);
        }
        catch (ex) {
          return next();
        }
        
        if (watchers.watchers) {
          app.results[name].push(watchers.watchers.length);
          watchers.watchers.forEach(function (username) {
            app.followers[username] = true;
          });
        }
        else if (watchers.error) {
          if (watchers.error[0] && watchers.error[0].match(/api rate limit exceeded/i)) {
            app.retry.push(name);
            return next();
          }
        
          app.emit('github::error', 'warn', watchers.error);
          app.results[name].push('No repository found');
        }
        
        next();
      });
      
    });
  }, app.retryGithub.bind(app, callback));
};

//
// ### function retryGithub (callback)
// #### @callback {function} Continuation to respond to when complete
// Waits a specified time interval before attempting to get follower information
// for all packages in `app.retry`.
//
app.retryGithub = function (callback) {
  if (!app.retry.length) {
    return callback();
  }
  
  app.emit('github::timeout', 'warn', 'Github API Rate limit exceeded')
  app.emit('github::timeout', 'warn', 'Waiting 60 seconds');
  app.emit('github::timeout', 'warn', 'Waiting for ' + app.retry.length + ' packages');
  app.emit('github::timeout', 'warn', app.retry.join(', '));

  setTimeout(function () {
    app.github(app.retry, callback);
  }, 1000 * 60);
};

//
// ### function collect (user, callback)
// #### @user {string} Users to collect packages for into `app.packages` and `app.results`.
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
        app.packages[name] = userPkgs[pkg];
        app.results[name] = [
          name,
          (userPkgs[pkg].description || 'No description').substr(0, truncate),
          userPkgs[pkg].maintainers.join(' ')
        ];
        
        if (app.results[name][1].length === truncate) {
          app.results[name][1] += '...  '
        }
      }
    });
    
    callback();
  });
}