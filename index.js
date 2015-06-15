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
var redisService = process.env["SERVICE_NAME"];

var myservice = appEnv.getService(redisService);
var credentials = myservice.credentials;

var cmd = "./node_modules/.bin/redis-commander";
cmd += " --redis-port " + credentials.port;
cmd += " --redis-host " + credentials.host;
cmd += " --redis-password " + credentials.password;
cmd += " --http-auth-username " + "lxu";
cmd += " --http-auth-password " + "password";
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