## Predix Security Starter Kit

### Prerequisites

- Node.js, used to run JavaScript tools from the command line, which includes a package manager called "npm".
- bower, a Node.js tool to install run-time dependencies.
- gulp, a Node.js-based build tool.

**To install dependencies:**

1)  Check your Node.js version.

```sh
node --version
```

The version should be at or above 0.10.x.

2)  If you don't have Node.js installed, or you have a lower version, go to [nodejs.org](https://nodejs.org) and click on the big green Install button.

3) In addition, you will need the Cloud Foundry CLI tool:
<https://github.com/cloudfoundry/cli/releases/tag/v6.12.2>
Then you'll need to login with your Predix credentials.

4) Run these commands in the root `security-starter` directory of this project.
```
npm install -g bower
npm install
bower install
```
(If you have trouble with the npm install, try `npm install --production` to install only the bare-bones dependencies to run the app, not include dev dependencies.)

### Getting Started

#### Running in Cloud Foundry
When running in the cloud, this application uses Redis as a session store.
You'll need to create a redis service named "security-starter-redis", using the `cf create-service` command.  (When the app is pushed to the cloud, it will bind to that service.)
Then run these commands to build & push to the cloud.
```
gulp
cf push <<unique-app-name>>
```

#### Finding your UAA URL
You need to run a few commands to create your instance of Predix UAA and find its URL.  
You'll push another simple node starter app, then bind it to your instance of UAA.  Don't forget your new admin secret!
```
cf create-service predix-uaa beta <<new-uaa-instance-name>> -c '{"adminClientSecret": "<<new-admin-secret>>"}'
git clone https://github.com/PredixDev/pdk-security-starter-nodejs.git
cd pdk-security-starter-nodejs
cf push <<new-sample-app-name>>
cf bind-service <<new-sample-app-name>> <<new-uaa-instance-name>>
cf env <<new-sample-app-name>>
```
Check the output of that last command, for the "predix-uaa" service, and copy the "uri" for that service, from the "credentials" object.

#### Running locally
You can start running the app locally in two ways.  For a quick start, run:
```
npm start
```
If you want to develop on this application, you probably want to use gulp:
```
gulp serve
```
This will do a few magic things for you.  The app will be served using BrowserSync, which is watching for changes, and will automatically reload when you make a change to the front end code.  It will also start the security-app server code using nodemon.  This will watch for changes to the server code, and restart the server whenever a change is made.

The app can run locally either inside the GE network, or outside the network.  It will check for the 'http_proxy' environment variable, and if present, will use a proxy agent to pass requests out to the Predix cloud.

At this time, the web socket requests will not work when running locally.  You'll need to change one line of code from "wss" to "ws" in the api-form web component.

[![Analytics](https://ga-beacon.appspot.com/UA-82773213-1/predix-tool-kit/readme?pixel)](https://github.com/PredixDev)

