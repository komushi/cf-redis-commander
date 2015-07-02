var exec = require('child_process').exec,
    child;

// child = exec('node child.js --help',
//   function (error, stdout, stderr) {
//     console.log('stdout: ' + stdout);
//     console.log('stderr: ' + stderr);
//     if (error !== null) {
//       console.log('exec error: ' + error);
//     }
// });

var cfenv = require("cfenv");
var appEnv = cfenv.getAppEnv();
var services = appEnv.getServices();



// function to get credential from cf env
var getCredentials = function() {

	var appEnv = cfenv.getAppEnv();
	var services = appEnv.getServices();
console.log(services);
	for (service in services) {
	  if (services[service].tags.indexOf("redis") >= 0) {
	    var credentials = services[service]["credentials"]

	    console.log("********************************");
	    console.log("Found ", service, " ", credentials);
	    console.log("********************************");

	    return credentials;
	  }
	}

};

var credentials = getCredentials();


var cmd = "./node_modules/.bin/redis-commander";
cmd += " --redis-port " + credentials.port;
cmd += " --redis-host " + credentials.host;
cmd += " --redis-password " + credentials.password;
cmd += " --http-auth-username " + "admin";
cmd += " --http-auth-password " + "pass";
cmd += " --port " + process.env.PORT;

console.log('cmd: ' + cmd);

child = exec(cmd,
  function (error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
    if (error !== null) {
      console.log('exec error: ' + error);
    }
});