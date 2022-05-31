'use strict';
process.env['NEW_RELIC_NO_CONFIG_FILE'] = true;     // to get newrelic variables from environment
import('newrelic');
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import apiutil from 'api-util';
import cors from 'cors';
import router from './routes.js';
import correlationId from 'correlation-id-mw';
import Logger from 'logger';
import utils from './api/helpers/utils.helpers.js';
import config from 'config';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import swaggerTools from 'swagger-tools';
import errorHandler from 'error-handler-mw';
const __dirname = dirname(fileURLToPath(import.meta.url));
let app = express();
let swaggerConfig = {
  appRoot: __dirname // required config
};

apiutil.fuseSwaggerSpecForEnv(swaggerConfig.appRoot);
const swaggerPath = swaggerConfig.appRoot + '/api/swagger/swagger.yaml';
const swaggerDocument = yaml.load(swaggerPath);
const routePath = (swaggerDocument.basePath === '/jw-api') ? swaggerDocument.basePath + '' : '';

app.use(apiutil.getSwaggerOptions().swaggerUi, swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(correlationId);
// install middleware
app.options('*', cors({
  "origin": "*",
  "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
  "preflightContinue": false,
  "allowedHeaders": ["authorization", "content-type", "if-none-match", "x-api-key", "cache-control", "x-nejmgroup-correlation-id"],
  "optionsSuccessStatus": 204
}));

// Install cors middleware
app.use(cors({
  "origin": "*",
  "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
  "preflightContinue": false,
  "allowedHeaders": ["authorization", "content-type", "if-none-match", "x-api-key", "cache-control", "x-nejmgroup-correlation-id"],
  "optionsSuccessStatus": 204
}));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

app.use(express.json());
app.use(express.urlencoded());

// swagger ui middleware

//Error handling With logger
app.use((req, res, next) => {

  if (req.headers['x-nejmgroup-correlation-id']) {
    req.correlationId = req.headers['x-nejmgroup-correlation-id'];
  }
  req.logger = Logger.logger({
    appId: config.get('SPLUNK_APP_ID'),
    correlationId: req.correlationId,
    level: config.get('LOG_LEVEL') || 'info',
    output: {
      splunk: config.get('LOG_SPLUNK'),
      console: config.get('LOG_CONSOLE')
    }
  });
  next();
});


// Error handler (log unhandled errors)
app.use(function (err, req, res, next) {
  if (err) {
    if (req.headers['x-nejmgroup-correlation-id']) {
      req.correlationId = req.headers['x-nejmgroup-correlation-id'];
    }

    const reqLogger = Logger.logger({
      appId: config.get('SPLUNK_APP_ID'),
      correlationId: req.correlationId,
      level: config.get('LOG_LEVEL') || 'info',
      output: {
        splunk: config.get('LOG_SPLUNK'),
        console: config.get('LOG_CONSOLE')
      }
    });
    utils.error('Unhandled Exception!', err, res, { reqLogger });
  } else {
    next();
  }
});

app.get("/swagger", (req, res) => {
  res.sendFile('./api/swagger/swagger.yaml', { root: __dirname });
});

// Initialize the Swagger middleware
  swaggerTools.initializeMiddleware(swaggerDocument, function (middleware) {
  app.use(middleware.swaggerMetadata());
  app.use(middleware.swaggerValidator());
  app.use(middleware.swaggerUi());
  app.use(errorHandler);
  app.use(routePath, router);

  let port = process.env.PORT || 10010;
  app.listen(port);
  
  console.log('Listening on port: ' + port);
  console.log('To see documentation go to: http://localhost:' + port + apiutil.getSwaggerOptions().swaggerUi);
});

export default app; 
