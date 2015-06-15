var optimist = require('optimist');

var args = optimist
  .alias('h', 'help')
  .alias('h', '?')
  .options('redis-port', {
    string: true,
    describe: 'The port to find redis on.'
  })
  .argv;

console.log('child process excuted!');

process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

if (args.help) {
  optimist.showHelp();
  return process.exit(0);
}