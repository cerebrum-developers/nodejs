'use strict';
import fs from 'fs';
import querystring from 'querystring';
import config from 'config';
import jsend from 'jsend-decorator';
import contentful from 'contentful';
import redis from 'redis';
import axios from 'axios';
import mlHelpers from '../helpers/mark-logic.helpers.js';
import logger from 'logger';
let pckg;

fs.readFile('./package.json', 'utf-8', (err, jsonString) => {
	pckg = JSON.parse(jsonString);
})


/*
	1. check required environment variables
	2. check connection to splunk -- TO DO. Will be done after JW-3763. Added placeholder for future implementation
	3. Check Splunk LogEndPoint for info level for now -- TO DO. Will be done after JW-3763. Added placeholder for future implementation
	4. check connection to nodejs-search-api
*/

// Health check index function
function index(req,res) {
	req.headers['x-nejmgroup-correlation-id'] = config.get("HEALTH_CHECK_CORRELATION_ID");
	const logger = req.logger;
	logger.info('**********health:index called jw-api api*************');

	const data = {
		name: 'jw-api',
		host: req.headers.host,
		version: pckg.version,
		release_date: fs.statSync('api/swagger/swagger.yaml').mtime, // Last modified time swagger file
		tests: []
	};
	let sessionToken;
	Promise.all([
		//1. check required environment variables
		checkConfigs(data, {logger}),
		//3.1 Add Splunk Log
		checkSplunkLogEndPoint(data, {logger}),			
		//2. check connection to splunk
		checkSplunkConnection(data, {logger}),
		checkAuthNAPIConnection(data, {logger}),
		checkAuthZAPIConnection(data, {logger}),
		checkDynamoDBConnection(data, {logger})
	])
	.then(() => {
			return checkLoginAPIEndPoint(data, {logger});
		})
	.then(result => {
			sessionToken = result.data.sessionToken;
			return checkNodeJsSearchAPIConnection(data, {logger});
	})
	.then(() => {
		return Promise.all([		
		checkNodeJsAuthorAPIConnection(data, {logger}),
		checkNodeJsContentAPIConnection(data, {logger}),
		checkS3BucketConnection(data, {logger}),
		checkNodeJsContentTransformAPIConnection(data, {logger}),
		checkRedisConnection(data, {logger}),
		checkConnectionContentful(data, {logger}),
		checkNodejsAuthorEndPoint(data, {logger}),
		checkNodejsSearchEndPoint(data, {logger}),
		checkNodejsContentEndPoint(data, {logger}),
		checkContentTransformAPIEndPointAPIG(data, {logger}),
		checkSearchAPIEndPoint(data, {logger}),
		checkArticleAPIEndPoint(data, sessionToken, {logger}),
		checkGetSpecialtyYearsAPIEndPoint(data, sessionToken, {logger}),
		checkGetPrintIssuesAPIEndPoint(data, sessionToken, {logger}),
		checkGetContentEntriesAPIEndPoint(data, {logger}),
		checkEndpointAuthNAuthentication(data, {logger}),
		checkEndpointAuthZAPIAccessRights(data, sessionToken, {logger}),
		//APIG End points
		checkGetSpecialtyYearsAPIGEndPoint(data, sessionToken, {logger}),
		checkGetPrintIssuesAPIGEndPoint(data, sessionToken, {logger}),
		checkGetContentEntriesAPIGEndPoint(data, {logger}),
		checkSearchAPIGEndPoint(data, {logger}),
		checkArticleAPIGEndPoint(data, sessionToken, {logger})
	])
	}).then(() => {
		const failedTests = data.tests.filter(x => x.status === 'error');
		if (failedTests && failedTests.length > 0) {
			res.status(500).json(jsend.error({message: `Health check failed ${failedTests.length} test(s)`, code: 'HEALTH_CHECK_ERROR', data}));
		} else {
			res.status(200).json(jsend.success(data));
		}
	}).catch(err => {
		// Unexpected error
		res.status(500).json(jsend.error({message: `Health check failed unexpectedly`, code: err.code, data: err}));
	});
}

//1. check required environment variables
function checkConfigs(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkConfig called from jw-api*************');
	const name = 'ENV config check';
	const startTime = (new Date()).getTime();
	const errors = config.getMissingConfigErrors(pckg.configRequired);

	if (errors.length > 0) {
		data.tests.push(jsend.error({message: errors.join(';'), code: 'InvalidConfigurationException', data: {name, duration: (new Date()).getTime() - startTime}}));
	} else {
		data.tests.push(jsend.success({name, duration: (new Date()).getTime() - startTime}));
	}
	return Promise.resolve(data);
}

/*
 2. check connection to splunk
   TO DO: 
	 1) As per discussion with Noman on 18/09/2018, we are putting this on hold until JW-3763 implemented.
	 2) We would like to move this code in the splunk logger so that this could be used from other APIs. No need to put duplicate code every where.
	JW-3763 Update references of logger to use v3.0.0 instead of branch auth-1051 and v2.x
	Refer code from nodejs-author-api

======== This task has been completed in version 3.0.0 =============	
*/
function checkSplunkConnection(data, loptions) {
	const loggerr = loptions.logger || {};
	const name = 'Splunk Connection';
	loggerr.info('**********health:checkSplunkConnection called from jw-api*************');
	const option = logger.checkSplunkConnection(loggerr);
	let uri = option.uri;
	 const options = {
		method: option.method,
		headers: option.headers,
		body: option.json
	};
	return resolvePromise(options, data, name,uri,loggerr);		
}

/*  
  2.1 Response from Dave: 
    1) Yes, the connection to Splunk should be tested. In general, any resource dependency should be tested.
	2) It should be both. For resources, it’s generally, can I connect to the resource, and then can I do something useful. 
	For logging, we should only have to do one type … like an info log (as opposed to testing different log types, error, warn, etc)
	TO DO: 
	 1) As per discussion with Noman on 18/09/2018, we are putting this on hold until JW-3763 implemented.
	 2) We would like to move this code in the splunk logger so that this could be used from other APIs. No need to put duplicate code every where.
	JW-3763 Update references of logger to use v3.0.0 instead of branch auth-1051 and v2.x
	Refer code from nodejs-author-api
*/
function checkSplunkLogEndPoint(data, loptions) {
	const loggerr = loptions.logger || {};
	const name = 'Splunk Endpoint';
	loggerr.info('**********health:checkSplunkLogEndPoint called from jw-api*************');
	const option = logger.checkSplunkLogEndPoint(loggerr);
	let uri = option.uri;
	 const options = {
		method: option.method,
		headers: option.headers,
		body: option.json
	};
	return resolvePromise(options, data, name,uri,loggerr);		
}
/************************************************************************************
    API ConnectionChecks & End Point 
*************************************************************************************/
//4. check connection to nodejs-search-api
// Verify that nodejs-search-api Server is up and accepting requests.
function checkNodeJsSearchAPIConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkNodeJsSearchAPIConnection called from jw-api*************');
	const name = 'Check Connection nodejs-search-api';
	let uri = config.get("SEARCH_API_URI") + "/docs";
	const options = {
		method: 'GET',
		headers: {}
	};
	return resolvePromise(options, data, name, uri,logger);

}

// Verify that nodejs-author-api Server is up and accepting requests.
function checkNodeJsAuthorAPIConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkNodeJsAuthorAPIConnection called from jw-api*************');
	const name = 'Check Connection nodejs-author-api';
	let uri = config.get("AUTHOR_API_URI") + "/docs";
	const options = {
		method: 'GET',
		headers: {}
	};
	return resolvePromise(options, data, name, uri,logger);
}

// Verify that nodejs-content-api Server is up and accepting requests.
function checkNodeJsContentAPIConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkNodeJsContentAPIConnection called from jw-api*************');
	const name = 'Check Connection nodejs-content-api';
	let uri = config.get("CONTENT_API_URI") + "/docs";
	const options = {
		method: 'GET',
		headers: {}
	};
	return resolvePromise(options, data, name, uri,logger);
}

// Verify that content-transform-api Server is up and accepting requests.
function checkNodeJsContentTransformAPIConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkNodeJsContentTransformAPIConnection called from jw-api*************');
	const name = 'Check Connection node js content-transform-api';
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get("NODEJS_HEALTHCHECK_CONTENT_TRANFORM_API") + "/docs";
	return resolvePromise(options, data, name, uri,logger);
}

// Verify that authn-api Server is up and accepting requests. check connection to authn-api
function checkAuthNAPIConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkAuthNAPIConnection called from jw-api*************');
	const name = 'Check Connection authn-api';
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get("AUTHN_API_URI") + "/docs";
	return resolvePromise(options, data, name, uri,logger);
}
// Verify that authz-api Server is up and accepting requests. check connection to authz-api
function checkAuthZAPIConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkAuthZAPIConnection called from jw-api*************');
	const name = 'Check Connection authz-api';
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get("AUTHZ_API_URI") + "/docs";
	return resolvePromise(options, data, name, uri,logger);
}
// check connection to dynamodb
function checkDynamoDBConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkDynamoDBConnection called from jw-api*************');
	const name = 'Check Connection dynamodb';
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get('AWS_END_POINT');
	return resolvePromise(options, data, name, uri,logger);
}

//check connection to redis
function checkRedisConnection(data, option) {
	const logger = option.logger || {};
	
    logger.info('**********health:checkRedisConnection called from jw-api*************: Checking redis connection');
	
    let name = 'Redis connection check';
	let startTime = (new Date()).getTime();	

	var redisclient = redis.createClient(config.get('REDIS_HOST'), {
		retry_strategy: function (options) {
		  logger.info(`Redis retry_strategy`, options);
		  if (options.attempt > 10) {
			this.redisclient = null;
			// report error using callback
			let message = `The server refused the connection`;
			if (options.error && options.error.code) {
			  message = `The server refused the connection. Code ${options.error.code}`;
			}
			logger.error(`Redis retry_strategy error detected ${message}`);
			return undefined;
		  }
		  // reconnect after
		  return Math.min(options.attempt * 100, 3000);
		}
	  });

	  redisclient.on('ready', () => {
		//logger.info(`Ready for redis`);
		data.tests.push({status: 'success', name: 'Ready for redis', duration: (new Date()).getTime() - startTime});
	  });
	  redisclient.on('connect', () => {
		//logger.info(`Connected to redis`);
		data.tests.push({status: 'success', name: 'Connected to redis', duration: (new Date()).getTime() - startTime});
	  });
	  redisclient.on('end', () => {
		//logger.info(`Ending connection to redis`);
		data.tests.push({status: 'success', name: 'Ending connection to redis', duration: (new Date()).getTime() - startTime});
	  });
	  redisclient.on('reconnecting', () => {
		logger.warn(`Reconnecting to redis`);
		data.tests.push({status: 'success', name: 'Reconnecting to redis', duration: (new Date()).getTime() - startTime});
	  });
	  redisclient.on('error', err => {
		logger.error(`Redis error detected ${err.message}`);
		data.tests.push({status: 'error', message: err.message, code: err.code, data: {name: 'Redis error detected', duration: (new Date()).getTime() - startTime}});
	  });

	  return Promise.resolve(data)	
}

// Function to check Contentful server whether it is serving content or not
function checkConnectionContentful(data, option) {
	const logger = option.logger || {};
	
    logger.info('checkConnectionContentful :: Checking Contentful connection');

    return new Promise(
      function (resolve, reject) {
        let name = 'Contentful connection check';
        let startTime = (new Date()).getTime();        

        var client = contentful.createClient({
          space: config.get('CONTENTFUL_SPACE'),
          accessToken: config.get('CONTENTFUL_TOKEN'),
          host:config.get('CONTENTFUL_HOST')
        })
      
        const result = client.getEntries({limit:1}).then(function(response){
            logger.info(`checkConnectioncontentful response: Total:: ${response.total}`);
            data.tests.push({status: 'success', name: 'contentful status value check', duration: (new Date()).getTime() - startTime});

            resolve();
          })
          .catch(function(err) {
            logger.error('checkConnectioncontentful :: error detected when checking status', err);
            data.tests.push({status: 'error', message: err.message, code: err.code, data: {name: 'contentful status value check', duration: (new Date()).getTime() - startTime}});

            resolve();
          });
      });        
  }


// check connection to S3 media buckets.
function checkS3BucketConnection(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkS3BucketConnection called from jw-api*************');
	const name = 'Check Connection S3 bucket';
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get("S3_BUCKET_HEALTHCHECK_URI");
	return resolvePromise(options, data, name, uri,logger);
}

//test nodejs-author-api endpoints
function checkNodejsAuthorEndPoint(data, option) {
	const logger = option.logger || {};
	
	logger.info('**********health:checkNodejsAuthorEndPoint called from jw-api*************');
	const name = 'Check nodejs-author-api End Point';
	const query = {
		doi: '10.1056/nejm-jw.NA43346'
	};		
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get("AUTHOR_API_URI") + '/v1/jwatch/getCOI?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}

//test nodejs-search-api endpoints
function checkNodejsSearchEndPoint(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkNodejsSearchEndPoint called from jw-api*************');
	const name = 'Check nodejs-search-api End Point';
	const query = {
		query: '(specialty:jwc AND state:active)',
		start:'1',
		pageLength:'1',
		sort:'pubdate',
		format:'json'
	};		
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get("SEARCH_API_URI") + '/v1/jwatch?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}
//test nodejs-content-api endpoints
function checkNodejsContentEndPoint(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkNodejsContentEndPoint called from jw-api*************');
	const name = 'Check nodejs-content-api End Point';
	const doi = '10.1056/nejm-jw.NA43346';
	const query = {
		type: 'article-xml',
		requestID:'nejm',
		product:'jw'
	};		
	const options = {
		method: 'GET',
		headers: {}
	};
	let uri= config.get("CONTENT_API_URI") + '/v1/article/' + doi + '/article?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}
//test content-transform-api endpoints
function checkContentTransformAPIEndPointAPIG(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkContentTransformAPIEndPointAPIG called from jw-api*************');
	const name = 'Content Transform APIG End Point';
	const doi = '10.1056/nejm-jw.NA43346';
	const query = {
		type: 'article-xml',
		requestID:'nejm',
		product:'jw'
	};	
	let uri = config.get("CONTENT_TRANSFORM_API") + '/transform/jw/' + doi + '?'+ querystring.stringify(query);	
	const options = {
		method: 'GET',
		json: true,
		headers: {
			"x-api-key":config.get("CONTENT_TRANSFORM_KEY")
		}
	};
	logger.info("CONTENT_TRANSFORM_API URI HEALTHCHECK: "+uri)
	return resolvePromise(options, data, name, uri,logger);
}

//test authn-api endpoints
function checkEndpointAuthNAuthentication(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkEndpointAuthNAuthentication called from jw-api*************');
	const name = 'Authenticate Anonymous, Free Country, Individual, Athens users';
	const startTime = (new Date()).getTime();
	
	const username = config.get('HEALTH_CHECK_USERNAME') || 'DEFINE_ME';
	const password = config.get('HEALTH_CHECK_PASSWORD') || 'DEFINE_ME';

	const payload = {
		clientId: config.get('JW_WEB_CLIENT_ID'),
		userIp: '12.23.34.12',
		fedId: '7093755',
		email: username,
		password: password,
		userAgent: 'any'
	};

	const options = {
		method: 'POST',
		body: payload,
		json: true // Automatically stringifies the body to JSON
	};
	let uri= config.get('AUTHN_API_URI') + '/v1/authenticate';
	return resolvePromise(options, data, name, uri,logger);
}

//test authz-api endpoints
function checkEndpointAuthZAPIAccessRights(data, sessionToken, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkEndpointAuthZAPIAccessRights called from jw-api*************');
	const name = 'Check AuthZ-api access rights';
	let uri = config.get('AUTHZ_API_URI') + '/v1/access-rights';
	let params = {
		uri: config.get('HEALTH_CHECK_ARTICLE')
	};
	const options = {
		method: 'GET',
		headers: {
			Authorization: "Bearer "+sessionToken
		}
	};
	uri = uri+'?' + mlHelpers.encodeUriParams(params);
	return resolvePromise(options, data, name, uri,logger);
	
  }

/********************************************************************************************
 * 
 * 									END POINTS
********************************************************************************************/

// Specialty years
function checkGetSpecialtyYearsAPIEndPoint(data, sessionToken, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkGetSpecialtyYearsAPIEndPoint called from jw-api*************');
	const name = 'Check GetSpecialtyYears API End Point';
	const query = {
		specialty: 'cardiology'
	};		
	const options = {
		method: 'GET',
		headers: {
			Authorization: "Bearer "+sessionToken,
			"Content-Type":"application/json"
		}
	};
	logger.info(`*healthcheck::uri http:// ${getHostName(data)}/getSpecialtyYears? ${querystring.stringify(query)}`);
	let uri= 'http://' + getHostName(data) + '/getSpecialtyYears?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}

//getPrintIssues
function checkGetPrintIssuesAPIEndPoint(data, sessionToken, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkGetPrintIssuesAPIEndPoint called from jw-api*************');
	const name = 'Check GetPrintIssues API End Point';
	const query = {
		specialty: 'cardiology',
		year:'2018'
	};	
	let uri = 'http://' + getHostName(data) + '/getPrintIssues?'+ querystring.stringify(query);
	const options = {
		method: 'GET',
		headers: {
			Authorization: "Bearer "+sessionToken,
			"Content-Type":"application/json"
		}
	};
	logger.info(`*healthcheck::uri http:// ${getHostName(data)}/getPrintIssues? ${ querystring.stringify(query)}`);
	return resolvePromise(options, data, name, uri,logger);
}

//content-entries
function checkGetContentEntriesAPIEndPoint(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkGeContentEntriesAPIEndPoint called from jw-api*************');
	const name = 'Check content-entries API End Point';
	const query = {
		contentID: '3wPR3k6wjuaiao6eIi220o',
		contentType:'dynamicPage',
		include:'1'
	};		
	const options = {
		method: 'GET',
		headers: {
			"Content-Type":"application/json"
		}
	};
	
	logger.info('*healthcheck::uri http://' + getHostName(data) + '/content-entries?'+ querystring.stringify(query));
	let uri = 'http://' + getHostName(data) + '/content-entries?'+ querystring.stringify(query);
		
	return resolvePromise(options, data, name, uri,logger);
}
// search API
function checkSearchAPIEndPoint(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkSearchAPIEndPoint called from jw-api*************');
	const name = 'Check search API End Point';
	const query = {
		query: 'articleDOI:10.1056/nejm-jw.NA43346',
		pageLength:'1',
		start:'1'
	};		
	const options = {
		method: 'GET',
		headers: {}
	};
	logger.info(`*healthcheck::uri http:// ${getHostName(data)} /search? ${querystring.stringify(query)}`);
	let uri = 'http://' + getHostName(data) + '/search?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}

// /article
function checkArticleAPIEndPoint(data, sessionToken, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkArticleAPIEndPoint called from jw-api*************');
	const name = 'Check article API End Point';
	const payload = {
		"doi": "10.1056/nejm-jw.FW113953"
	};		
	const options = {
		method: 'POST',
		body: JSON.stringify(payload),
		headers: {
			Authorization: "Bearer "+sessionToken,
			"Content-Type":"application/json"
		}		
	};  
	logger.info(`*healthcheck::uri http:// ${getHostName(data)} /article`);

	let uri = 'http://' + getHostName(data) + '/article';
	return resolvePromise(options, data, name, uri,logger);
}

// /article. Need to get sessionToken and used everywhere
function checkLoginAPIEndPoint(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkLoginAPIEndPoint called from jw-api*************');
	const name = 'Check login API End Point';
	const startTime = (new Date()).getTime();
	const username = config.get('HEALTH_CHECK_USERNAME') || 'DEFINE_ME';
	const password = config.get('HEALTH_CHECK_PASSWORD') || 'DEFINE_ME';
	const payload ={
		"email": username,
		"password": password
	  };		
	const options = {
		method: 'POST',
		json: true,
		headers: {
			"x-api-key": config.get("X_API_KEY_HEALTHCHECK_LOGIN"),
			"Content-Type":"application/json"
		}		
	};
	logger.info(`*healthcheck::uri http:// ${config.get('HEALTHCHECK_APIG_JWAPI_URI')} //jw-api/login`);
	
	let uri = config.get('HEALTHCHECK_APIG_JWAPI_URI') + '/jw-api/login';
	
	return axios.post(uri, payload, options).then(result => {
		const errorEle = result.data.data.handlers.find(element => element.status === 'error');
		if (errorEle) {
			data.tests.push(jsend.error({message: errorEle.error.message, code: errorEle.error.code, data: {name, duration: (new Date()).getTime() - startTime}}));
		} else {
			data.tests.push(jsend.success({name, duration: (new Date()).getTime() - startTime}));
		}
		return Promise.resolve(result.data);
	}).catch(err => {
		data.tests.push(jsend.error({message: err.message, code: err.code, data: {name, duration: (new Date()).getTime() - startTime}}));
		return Promise.reject(err); // Stop check up chain since no token returned
	});
}

/******************************************************************
					API Gateway End Points
*******************************************************************/

// Specialty years
function checkGetSpecialtyYearsAPIGEndPoint(data, sessionToken, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkGetSpecialtyYearsAPIGEndPoint called from jw-api*************');
	const name = 'Check GetSpecialtyYears APIG End Point';
	const query = {
		specialty: 'cardiology'
	};		
	
	const options = {
		method: 'GET',
		headers: {
			Authorization: "Bearer "+sessionToken,
			"x-api-key": config.get("X_API_KEY_HEALTHCHECK_LOGIN"),
			"Content-Type":"application/json"
		}
	};
	let uri = config.get("HEALTHCHECK_APIG_JWAPI_URI") + '/jw-api/getSpecialtyYears?'+ querystring.stringify(query);
		
	return resolvePromise(options, data, name, uri,logger);
}

//getPrintIssues
function checkGetPrintIssuesAPIGEndPoint(data, sessionToken, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkGetPrintIssuesAPIGEndPoint called from jw-api*************');
	const name = 'Check GetPrintIssues APIG End Point';
	const query = {
		specialty: 'cardiology',
		year:'2018'
	};		
	const options = {
		method: 'GET',
		headers: {
			Authorization: "Bearer "+sessionToken,
			"x-api-key": config.get("X_API_KEY_HEALTHCHECK_LOGIN"),
			"Content-Type":"application/json"
		}
	};
	let uri= config.get("HEALTHCHECK_APIG_JWAPI_URI") + '/jw-api/getPrintIssues?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}

//content-entries
function checkGetContentEntriesAPIGEndPoint(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkGeContentEntriesAPIGEndPoint called from jw-api*************');
	const name = 'Check content-entries APIG End Point';
	const query = {
		contentID: '3wPR3k6wjuaiao6eIi220o',
		contentType:'dynamicPage',
		include:'1'
	};		
	const options = {
		method: 'GET',
		headers: {			
			"x-api-key": config.get("X_API_KEY_HEALTHCHECK_LOGIN"),
			"Content-Type":"application/json"
		}
	};
	let uri = config.get("HEALTHCHECK_APIG_JWAPI_URI") + '/jw-api/content-entries?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}
// search API
function checkSearchAPIGEndPoint(data, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkSearchAPIGEndPoint called from jw-api*************');
	const name = 'Check search APIG End Point';
	const query = {
		query: 'articleDOI:10.1056/nejm-jw.NA43346',
		pageLength:'1',
		start:'1'
	};		
	const options = {
		method: 'GET',
		headers: {			
			"x-api-key": config.get("X_API_KEY_HEALTHCHECK_LOGIN"),
			"Content-Type":"application/json"
		}
	};
	let uri = config.get("HEALTHCHECK_APIG_JWAPI_URI") + '/jw-api/search?'+ querystring.stringify(query);
	return resolvePromise(options, data, name, uri,logger);
}

// /article
function checkArticleAPIGEndPoint(data, sessionToken, option) {
	const logger = option.logger || {};
	logger.info('**********health:checkArticleAPIGEndPoint called from jw-api*************');
	const name = 'Check article APIG End Point';
	const payload = {
		"doi": "10.1056/nejm-jw.FW113953"
	};		
	const options = {
		method: 'POST',
		body: JSON.stringify(payload),
		headers: {
			Authorization: "Bearer "+sessionToken,
			"x-api-key": config.get("X_API_KEY_HEALTHCHECK_LOGIN"),
			"Content-Type":"application/json"
		}		
	};
	let uri = config.get("HEALTHCHECK_APIG_JWAPI_URI") + '/jw-api/article';
	return resolvePromise(options, data, name, uri,logger);
}

// Function to return host name to check End Points
function getHostName(data){
	let host = data.host;
	if(config.get("NODE_ENV") == "development"){
		host = 'jw-api.nejmgroup-dev.org';
	}
	return host;
}


//Common handling of setting success/error message
function resolvePromise(options, data, name, uri,logger) {
	const startTime = (new Date()).getTime(); 
		if (options.method === 'GET') {
			return axios.get(uri, options).then(() => {
				data.tests.push(jsend.success({ name, duration: (new Date()).getTime() - startTime }));
				return Promise.resolve(data);
			})
				.catch(err => {
					logger.error(`Error in ${name} healthcheck- axios get`, err);
					data.tests.push(jsend.error({ message: err.message, code: err.code, data: { name, duration: (new Date()).getTime() - startTime } }));
					return Promise.resolve(data);
				});
		
		} else {
			return axios.post(uri, options.body, options).then(() => {
				data.tests.push(jsend.success({ name, duration: (new Date()).getTime() - startTime }));
				return Promise.resolve(data);
			})
				.catch(err => {
					logger.error(`Error in ${name} healthcheck-axios post `,err);
					data.tests.push(jsend.error({ message: err.message, code: err.code, data: { name, duration: (new Date()).getTime() - startTime } }));
					return Promise.resolve(data);
				});
		}
	
}

export default index;