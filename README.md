# jw-api
API for jw-web UI

## Prerequisites
#### Install Node.js
[![Generic badge](https://img.shields.io/badge/node-v10.17.0-<COLOR>.svg)](https://shields.io/)

Visit https://nodejs.org/en/ and install the latest version of Node.js.  This will allow you to take advantage of Node.js' package ecosystem, npm, which you will use to install all the necessary dependencies for this project.




#### Updating npm
Node comes with npm installed so you should have a version of npm. However, npm gets updated more frequently than Node does, so you'll want to make sure it's the latest version.  Do so by opening Terminal, then type `npm install npm -g`, and hit enter.

#### Installing swagger-node
This project was built using the swagger-node module, you will want to install this to have access to the 'swagger' command line.  Do so by opening Terminal then type `npm install swagger -g`, and hit enter.  For more information on this module please visit: https://github.com/swagger-api/swagger-node

#### Install modules
After you have Node.js installed, open Terminal, `cd` into the jw-api folder, type `npm install`, and press enter.  This will install all of the required node_modules that the project depends on.


#### Export environment variables
jw-api will require certain environment variables to function properly.  

To find out what variables are needed for which environment please see this wiki:
http://wiki.mms.org/display/DBI/JW+Web+UI+API

## Using the service
#### Run the service and view the API documentation
Run `node app.js` or `npm start` to start the service.  You should now be able to visit http://localhost:10010/jw-api/docs.  Here you can browse the accepted API calls, test the calls out, and view the response.

#### Test the service
Run `npm test` to test the Swagger project.
