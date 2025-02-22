var fs = require('fs');
const express = require("express");
const app = express();
// Listen on a specific host via the HOST environment variable
var host = process.env.HOST || '0.0.0.0';
// Listen on a specific port via the PORT environment variable
var port = process.env.PORT || 8080;
var applicationPath = process.env.CORSANYWHERE_PATH || '';
if (process.env.CORSANYWHERE_PATH) {
  applicationPath = '/' + applicationPath.replace(/\//g, '');
}

// Grab the blacklist from the command-line so that we can update the blacklist without deploying
// again. CORS Anywhere is open by design, and this blacklist is not used, except for countering
// immediate abuse (e.g. denial of service). If you want to block all origins except for some,
// use originWhitelist instead.
var originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
var originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);
function parseEnvList(env) {
  if (!env) {
    return [];
  }
  return env.split(',');
}

// Set up rate-limiting to avoid abuse of the public CORS Anywhere server.
var checkRateLimit = require('cors-anywhere/lib/rate-limit')(process.env.CORSANYWHERE_RATELIMIT);

if (process.env.KEY || process.env.CERT) {
  var httpsOptions = {
    key: readTLSContent(process.env.KEY),
    cert: readTLSContent(process.env.CERT),
  };
}

function readTLSContent(tls) {
  if (tls.startsWith('-----')) {
    return tls
  } else {
    return fs.readFileSync(tls);
  };
}

var corsAnywhere = require('cors-anywhere/lib/cors-anywhere');
var corsServer = corsAnywhere.createServer({
  originBlacklist: originBlacklist,
  originWhitelist: originWhitelist,
  requireHeader: ['origin', 'x-requested-with'],
  checkRateLimit: checkRateLimit,
  removeHeaders: [
    'cookie',
    'cookie2',
    // Strip Heroku-specific headers
    'x-request-start',
    'x-request-id',
    'via',
    'connect-time',
    'total-route-time',
    // Other Heroku added debug headers
    // 'x-forwarded-for',
    // 'x-forwarded-proto',
    // 'x-forwarded-port',
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
    xfwd: false,
  },
  httpsOptions: httpsOptions,
  helpFile: 'customHelpText.txt',
  corsMaxAge: 300
});

app.get(applicationPath + '*', (req, res, next) => {
  req.url = req.url.replace(applicationPath, ''); 
  corsServer.emit('request', req, res);
});

app.listen(port, host, () => {
  console.log('Running CORS Anywhere on ' + host + ':' + port + applicationPath);
});