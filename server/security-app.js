'use strict';

// if (process.env.NODE_ENV === 'production' && process.env.PREDIX_ENV === 'VPC') {
// 	require('newrelic'); // This needs to be loaded before other modules.
// }
var httpServer = require('http').createServer();
var express = require('express');
var path = require('path');
var app = express();
var session = require('express-session');
var expressProxy = require('express-http-proxy');
var historyApiFallback = require('connect-history-api-fallback');
var RedisStore = require('connect-redis')(session);
var url = require('url');
var WebSocketServer = require('ws').Server;
var WebSocket = require('ws');
var HttpsProxyAgent = require('https-proxy-agent');
var helmet = require('helmet');

var sockets = {};
var corporateProxyAgent;
var sessionOptions = {
	secret: 'njk2389adsf98yr23hre98',
	name: 'JSESSIONID', // This tells CF to keep sessions on a single instance of the app. 
	resave: true,
	saveUninitialized: false,
	// proxy: true,   // not sure about this one...
	cookie: {secure: true}
};
var helmetCspDirectives = {
	defaultSrc: ["'self'"],
	scriptSrc: ["'self'", "'unsafe-inline'"],
	styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
	fontSrc: ["'self'", "https://fonts.gstatic.com"]
};

// Set up some options for cloud vs. local, and proxy vs. no proxy.
var corporateProxyServer = process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy;
if (corporateProxyServer) {
		corporateProxyAgent = new HttpsProxyAgent(corporateProxyServer);
}

// app.use('/headers', function(req, res) {
// 	console.log('ALL REQUEST HEADERS ****');
// 	console.log(req.headers);
// 	res.send(req.headers);
// });

app.use(helmet.xssFilter());
app.use(helmet.frameguard());
app.use(helmet.hidePoweredBy());
app.use(helmet.noSniff());
app.use(helmet.hsts({
  maxAge: 7776000000,  // 90 days in ms
  force: true
}));
app.set('trust proxy', 1);

console.log('PREDIX_ENV: ' + process.env.PREDIX_ENV);
console.log('NODE_ENV: ' + process.env.NODE_ENV);
if (process.env.NODE_ENV !== 'production') {
	delete sessionOptions.cookie;
	helmetCspDirectives.connectSrc = ["'self'", "localhost:5002", "ws://localhost:5002"];
	app.use(helmet.csp(helmetCspDirectives));
	app.use(express.static(path.join(__dirname, '../.tmp')));
	app.use('/bower_components', express.static(path.join(__dirname, '../bower_components')));
	app.use(express.static(path.join(__dirname, '../app')));
} else {
	if (process.env.PREDIX_ENV === 'VPC') {
		// HACK needed for VPC environment.  seems we can't set secure cookie there, due to cloud config.
		delete sessionOptions.cookie;
	}
	app.use(helmet.csp(helmetCspDirectives));
	app.use(express.static(path.join(__dirname, '../www')));
}

if (process.env.VCAP_SERVICES) {  // use redis when running in cloud
	var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
	var vcapRedis = vcapServices['predix-cache'][0];
	sessionOptions.store = new RedisStore({
		host: vcapRedis.credentials.host,
		port: vcapRedis.credentials.port,
		pass: vcapRedis.credentials.password,
		ttl: 1200 // seconds = 20 min
	});
}

app.use(session(sessionOptions));

function cleanResponseHeaders (rsp, data, req, res, cb) {
	res.removeHeader('Access-Control-Allow-Origin');
	res.removeHeader('www-authenticate'); // prevents browser from popping up a basic auth window.
	cb(null, data);
}

function getUaaUrlFromSession(req) {
	//console.log('UAA URL from session: ' + req.session.uaaUrl);
	return req.session.uaaUrl;
}

function setProxyAgent(req) {
	if (corporateProxyAgent) {
		req.agent = corporateProxyAgent;
	}
	return req;
}

app.use('/uaalogin', function storeUrlInSession(req, res, next) {
    var data = '';
    req.on('data', function(chunk) {
      data += chunk;
    });
    req.on('end', function() {
			// don't use body-parser, because it changes the body.  We'll read the form values with plain javascript.
			var params = data.split('&');
			params.forEach(function(p) {
				var kvp = p.split('=');
				if (kvp[0] === 'uaaUrlInput' && kvp[1]) {
					var uaaHost = kvp[1].replace(encodeURIComponent('https://'), '');
					console.log('storing URL in session. ' + uaaHost);
					req.session.uaaUrl = uaaHost;
				}
			});
    });
		next();
	},
	expressProxy(getUaaUrlFromSession, {
			https: true,
			forwardPath: function () {
				return '/oauth/token';
			},
			intercept: cleanResponseHeaders,
			decorateRequest: setProxyAgent
		}
	)
);

app.use('/logout', function logout(req, res) {
		req.session.destroy();
		res.status(200).send({"message": "Session destroyed."});
});

app.use('/api', function(req, res, next) {
	if (!req.session.uaaUrl) {
		res.status(500).send({"error": "No UAA URL in session. Please login again."});
	} else {
		next();
	}
});

app.get('/session', (req, res) => {
  if (req.session && req.session.uaaUrl) {
    res.status(200).send({
      uaaUrl: req.session.uaaUrl
    });
  } else {
    res.status(200).send({});
  }
});

// using express-http-proxy, we can pass in a function to get the target URL for dynamic proxying:
app.use('/api', expressProxy(getUaaUrlFromSession, {
		https: true,
		forwardPath: function (req) {
			//   console.log("Forwarding request: " + req.originalUrl);
			  var forwardPath = url.parse(req.url).path;
			  return forwardPath;
		},
		intercept: cleanResponseHeaders,
		decorateRequest: setProxyAgent
	}
));

app.use('/proxy-api', expressProxy(function(req) {
	var apiUrl = req.get('x-endpoint');
	if (apiUrl) {
		apiUrl = url.parse(apiUrl).hostname;
	}
	console.log('endpoint from headers: ' + apiUrl);
	return apiUrl;
}, {
	https: true,
	forwardPath: function (req) {
		var forwardPath = url.parse(req.url).path;
		// console.log('forwardPath: ' + forwardPath);
		return forwardPath;
	},
	intercept: cleanResponseHeaders,
	decorateRequest: setProxyAgent,
	limit: '250mb'
}));

app.use('/open-ws', function(req, res) {
	var wsUrl = req.get('x-endpoint'),
	    auth = req.get('authorization'),
			zone = req.get('predix-zone-id');
	if (!auth || !zone || !wsUrl) {
		res.status(500).send({"error": "one of the required headers is missing: x-endpoint, authorization, or predix-zone-id."});
	} else {
		console.log('opening a socket to: ' + wsUrl);
		// TODO: check origin? do some security stuff.
		// open socket to wsUrl, pass in authorization & zone-id headers.
		var headers = {
			"authorization": auth,
			"predix-zone-id": zone,
			"origin": "https://www.predix.io" // some value is required here.
		};
		var socket = new WebSocket(wsUrl, {headers: headers});
		socket.on('error', function(error) {
			console.log('error opening socket: ' + error);
			res.status(500).send({"error": error + '', "url": wsUrl});
		});
		socket.on('close', function(code, message) {
			console.log('socket closed. ' + code + ' ' + message);
		});
		socket.on('open', function() {
			// store socket in memory with an ID & expiration
			// return socket ID to browser
			var socketId = Math.random() * 10000000000000000000;
			socket.socketId = socketId;
			socket.expiration = Date.now() + 1200000; // 20 min
			sockets[socketId] = socket;
			// console.log('ready state: ' + socket.readyState);
			console.log('sockets: ' + Object.keys(sockets).length);
			res.status(200).send({"socketId": socketId, "readyState": "OPEN"});
		});
	}
});

app.use('/close-ws', function(req, res) {
	// find socket in memory by ID. close & delete.
	if (req.get('x-socketid') && sockets[req.get('x-socketid')]) {
		sockets[req.get('x-socketid')].terminate();
		delete sockets[req.get('x-socketid')];
		console.log('deleted a socket. sockets remaining: ' + Object.keys(sockets).length);
	}
	res.status(200).send({"message": "Socket closed."});
});

app.get('/health', function(req, res) {
	var memoryUsage = process.memoryUsage();
	if (memoryUsage.heapTotal && memoryUsage.heapUsed && memoryUsage.heapTotal > 0) {
		memoryUsage.heapPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
	}
	res.status(200).send({"status": "ok", "memoryUsage": memoryUsage});
});

app.use(historyApiFallback());
app.use(function logErrors(err, req, res, next) {
	console.error(err.stack);
	console.error('-- From Request: ', req.url);
	next();
});

////////// Web socket server ////////
var wsServer = new WebSocketServer({
	server: httpServer,
	verifyClient: function(info) {
		if (!process.env.VCAP_APPLICATION) {
			return true; // running locally
		} else {
			// verify host and origin headers.
			var validHost = false, validOrigin = false;
			var vcap = JSON.parse(process.env.VCAP_APPLICATION);
			if (vcap.application_uris) { 
				vcap.application_uris.some(uri => {
					validHost = uri === info.req.headers.host ? true : false;
          validOrigin = info.origin.indexOf(uri) >= 0 ? true : false;
          return validHost && validOrigin;
				});
			}
			console.log('verifyClient returning', validHost && validOrigin);
			return validHost && validOrigin;
		}
	}
});

wsServer.on('connection', function connection(ws) {
	ws.on('message', function incoming(message) {
    // console.log('received: %s', message);
		var incomingData;
		try {
			incomingData = JSON.parse(message);
		} catch (e) {
			ws.send('{"error": ' + e + '}');
			return;
		}
		if (!incomingData.socketId) {
			ws.send('{"error": "missing socketId"}');
			return;
		}
		// console.log('message from browser with socketId:', incomingData.socketId);
		var apiSocket = sockets[incomingData.socketId];
		if (!apiSocket || apiSocket.readyState !== WebSocket.OPEN) {
			ws.send('{"error": "socket to back end API has closed."}');
			delete sockets[incomingData.socketId];
			ws.close();  // also close socket to browser.
			return;
		}
		// pass request through to back end api:
		if (!incomingData.handshake) {
			apiSocket.send(message);
		}
		apiSocket.on('message', function(data) {
			// console.log('data from api: ' + data);
			if (ws.readyState === WebSocket.OPEN) {
				// console.log('sending data to UI: ' + data);
				ws.send(data);
			}
		});
		apiSocket.on('close', function(code, message) {
			console.log('socket to back end API has closed. code: ' + code + ' message: ' + message);
			delete sockets[incomingData.socketId];
		});
		apiSocket.on('error', function(error) {
			console.error('error from socket connection to back end API. ', error);
		});
  	});
	ws.on('close', function(code) {
		console.log('close message received from client.', code);
	});
	ws.on('error', function(error) {
		console.log('error from client: ', error);
	});
});

wsServer.on('error', function(error) {
	console.error('error emitted from websocket server', error);
});

setInterval(function cleanupSockets() {
	console.log('cleanupSockets');
	var socketIds = Object.keys(sockets);
	socketIds.forEach(function(socketId) {
		// console.log('socket id: ' + socketId + ' expiration: ' + sockets[socketId].expiration);
		if (sockets[socketId].expiration < Date.now()) {
			console.log('deleting a socket.');
			sockets[socketId].terminate();
			delete sockets[socketId];
		}
	});
	console.log('sockets remaining: ' + Object.keys(sockets).length);
}, 1200000);
///////// End Web socket server /////////

httpServer.on('request', app);
httpServer.listen(process.env.VCAP_APP_PORT || 5000, function() {
	console.log('Listening on port ' + httpServer.address().port);
});
httpServer.on('clientError', function(error) {
	console.error('client error', error);
})

module.exports = app;
