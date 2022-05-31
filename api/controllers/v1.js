'use strict';

// Dependant node modules
import axios from 'axios';
import config from 'config';
import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';
import atob from 'atob';
// Helper functionality.
import mlHelpers from '../helpers/mark-logic.helpers.js';
import contentHelpers from '../helpers/content.helpers.js';
import authHelpers from '../helpers/auth.helpers.js';
import utils from '../helpers/utils.helpers.js';
//Configuration for s3 interaction
const JW_AUTH_KEY = config.get('JW_AUTH_KEY') || '';
const JWT_DOMAIN = config.get('JWT_DOMAIN') || '';
const REDIRECT_URL = config.get('REDIRECT_URL') || '';

// Mark Logic configuration values.
const ML_API_CLASS = mlHelpers.ML_API_CLASS;

const s3 = new AWS.S3({
  apiVersion: '2014-11-13',
  region: config.get('AWS_REGION') || 'us-east-1'
});
const googleReferrer = /^https?:\/\/\w+\.google\./i;

const googleReg = /googlebot/i;
const prerenderReg = /prerender/i;

export default {

  async search(req, res) {
    const logger = req.logger;

  // Create our base URI.
  // let uri = config.get('ML_API_URI') + '/search/' + ML_API_VERSION + '/' + ML_API_CLASS;
  let uri = config.get('SEARCH_API_URI') + '/v1/' + ML_API_CLASS;


  if (mlHelpers.hasNestedProperty(req, 'query')) {

    let query = req.query.query;
    let regx = new RegExp(/\s*state\s*:\s*inactive\s*/gi);
    let regy = new RegExp(/\s*state\s*:\s*active\s*/gi);
    if (regx.exec(query)) {
      query = query.replace(regx, '(state:active');
    } else if (!regy.exec(query)) {
      query += ' AND (state:active)';
    }

    let uriParams = {
      format: 'json',
      query: query
    };

    if (mlHelpers.hasNestedProperty(req, 'query', 'start')) {
      uriParams.start = req.query.start;
    }
    if (mlHelpers.hasNestedProperty(req, 'query', 'pageLength')) {
        uriParams.pageLength = req.query.pageLength;
    }
    if (mlHelpers.hasNestedProperty(req, 'query', 'sort')) {
        uriParams.sort = req.query.sort;
    }
    if (mlHelpers.hasNestedProperty(req, 'query', 'order')) {
      uriParams.order = req.query.order;
    }

    if (Object.keys(uriParams).length > 0) {
      uri += '?' + mlHelpers.encodeUriParams(uriParams);
    }
  }
  try {

    let options = {
      method: 'GET',
      json: true
    };
    const response = await axios.get(uri, options);
    // Sorting by created date incase pubdate is equal and not will be applied on approved date.
    if (response.data.data.result)  {
      let results = response.data.data.result;
      if(req.query.sort ==='createddate' || req.query.sort ==='pubdate') {
        response.data.data.result = results.sort((a, b) => {
          if (a.pubdate < b.pubdate) return 1;
          if (a.pubdate > b.pubdate) return -1;
          if (a.pubdate === b.pubdate) {
            if (a.created < b.created) return 1;
            if (a.created > b.created) return -1;
          }
          return 0;
        });
      }
      
      
      response.data.data.result = mlHelpers.formatSearchResult(response.data);
    }
    res.status(200).json(response.data);
  } 
  catch (err) {
    logger.error('Got an error with ML search', err.message);
      res.status(err.response.status || 500).json(err.response.data ? err.response.data : 'Error with search request')
    };
},

async article(req, res) {

  const logger = req.logger;
  let params = req.body,
    headers = req.headers;
  let type = '';
  let identifier = '';
    
  if (!headers.authorization) {
    let loggerError = {status: 'fail', data: {code: 'ForbiddenException', message: 'No credentials set'}};
    logger.error('Got an error with ML article', loggerError);
    res.status(403).json(loggerError);
    return;
  }

  if (params.hasOwnProperty('tflkey')) {
    type = 'tollfree';

    let match = params.doi.split('.').reverse()[0].match(/[a-z]{2}\d+/i);
    if (!match) {
      let loggerError = {status: 'fail', data: {code: 'NotFoundException', message: 'Could not resolve articleID from parameter'}};
      logger.error('Got an error with ML article', loggerError);
      res.status(404).json(loggerError);
      return;
    }

    let articleid = match[0];

    if (!params.referrer) {
      params.referrer = 'Any';
    } else {
      params.referrer = encodeURIComponent(params.referrer);
    }
    identifier = `tflkey:${params.tflkey}:articleid:${articleid}:referrer:${params.referrer}`;

  } else {
    type = 'doi';
    identifier = params.doi;
  }

  if (googleReg.test(headers['user-agent']) || prerenderReg.test(headers['user-agent']) || googleReferrer.test(params.referrer)) {
      try {
        // Bypass auth call for google (First Click Free)
        const html = await contentHelpers.getArticleHTML(params.doi);
        res.status(200).send(html);
      }
      catch(err) {
        logger.error('Got an error with ML article', err.response.data);
        res.status(err.response.status || 500).json(err.response.data || 'Error with search request');
      }
  } else {
    let authHeader = headers.authorization.split(' ')[1] !=undefined? headers.authorization.split(' ')[1]:'';

    try {
      const response = await authHelpers.access(type, identifier, authHeader);
      let json = response.data;
      if (json.data.accessRights.allow) {
        try {
          // api call goes here
          const html = await contentHelpers.getArticleHTML(params.doi);
          res.status(200).send(html);
        }
        catch(err) {
          logger.error('Got an error with ML article', err.response.data);
          res.status(err.response.status || 500).json(err.response.data || 'Error with search request');
        }
      } else {
        // Return 403 with different code in case it was Athens user who did not have subscribtion to jwatch
        let sessionToken = jwt.decode(authHeader);
        if (sessionToken.profile && sessionToken.profile.ATHENS && sessionToken.profile.ATHENS.access == false) {
          logger.error('User does not have jwatch subscription', sessionToken.profile);
          res.status(403).json({status: 'fail', data: {code: 'NoSubscriptionException', message: 'User does not have jwatch subscription'}});
        }
        else {
          logger.error('User is forbidden from accessing resource', sessionToken.profile);
          res.status(403).json({status: 'fail', data: {code: 'ForbiddenException', message: 'User is forbidden from accessing resource'}});
        }
      }
    }
    catch (err) {
      if (err.response.status >= 400 && err.response.status < 500) {
        let loggerError = err.response.data ? err.response.data : "Error determining authorization for article";
        logger.error('Got an error with ML article', loggerError);
        res.status(err.response.status).json(loggerError);
      } else {
        let loggerError = err.response.data ? err.response.data : "Error determining authorization for article";
        logger.error('Got an error with ML article', loggerError);
        res.status(err.response.status || 500).json(loggerError);
      }
    }
  }
},

/*
*
*
*   BEGIN AUTH FUNCTIONALITY
*
*
*/

async login(req, res) {
  // Set our logging context.
  const logger = req.logger;
  // Can use req.ip, but will need to parse ipv4 address out of ipv6 format.
  if (mlHelpers.hasNestedProperty(req, 'body')) {
    let params = req.body;
    let headers = req.headers;
    params['userIp'] = utils.get_first_ip_from_header_value(headers['fastly-client-ip']) || utils.get_first_ip_from_header_value(headers['x-forwarded-for']) || '127.0.0.1';
    params['userAgent'] = headers['user-agent'];
    //logger.info("Login params from body:", params);

    try {
      const result = await authHelpers.login(params);
      res.status(result.status || 200).json(result.data);
    }
    catch(err) {
      logger.error('Got an error with auth login ', err.response.data);
      res.status(err.response.status || 500).json(err.response.data || 'Error with login request');
    }
  } else {
    logger.info('Invalid parameters for jw-api login');
    res.status(500).json('Missing required parameters');
  }
},

  async loginAthens(req, res) {

  let body = req.body.authnObj;
  let headers = req.headers;
  const logger = req.logger;
  logger.info('ATHENS ENCODED DATA:' + body);
    let authnObj = body;
  if(!authnObj) {
    logger.error('ATHENS Error:', {message: "Invalid payload from OpenAthens: " + authnObj});
    res.status(400).json({message: "Invalid payload from OpenAthens: " + authnObj});
  }

  authnObj = decodeURIComponent(authnObj);
  let atobString = atob(authnObj);
  let decodedPayload = JSON.parse(atobString);

  let athensParams = { "fedId": decodedPayload['fedid'] };
  if (decodedPayload['organisationid']) {
    athensParams['organizationId'] = decodedPayload['organisationid'];
  }
  athensParams['userIp'] = utils.get_first_ip_from_header_value(headers['fastly-client-ip']) || utils.get_first_ip_from_header_value(headers['x-forwarded-for']) || '127.0.0.1';
  athensParams['userAgent'] = headers['user-agent'];

  try {
    const result = await authHelpers.login(athensParams);

    logger.info('ATHENS RESULT:' + JSON.stringify(result.data));
    let sessionToken = result.data.data.sessionToken;

    let sessionPayload = jwt.decode(sessionToken);
    let sessionExpires = new Date(sessionPayload.exp * 1000 + (1000 * 60 * 60));

    res.cookie(JW_AUTH_KEY, sessionToken, {expires: sessionExpires, domain: JWT_DOMAIN, secure: true});

    let TRIMMED_REDIRECT_URL  = REDIRECT_URL.replace(/\/$/, '');
    if(typeof decodedPayload['ctx']!=='undefined' && typeof decodedPayload['ctx'].targetUrlLink!=='undefined'
      ) {
        let targetUrl = decodedPayload['ctx'].targetUrlLink;
        targetUrl = targetUrl.replace(/^\//, '');
        logger.info(`ATHENS REDIRECTING TO TARGET: ${TRIMMED_REDIRECT_URL}/${targetUrl}`);
        res.redirect(`${TRIMMED_REDIRECT_URL}/${targetUrl}`);
    } else {
      logger.info(`ATHENS REDIRECTING TO HOME: ${TRIMMED_REDIRECT_URL}`);
      res.redirect(TRIMMED_REDIRECT_URL);
    }
  }
  catch(err) {
    let loggerError = err.response.data || 'Error with login request';
    logger.error('Got an error with Athen login ', loggerError);
    res.status(err.response.status || 500).json(loggerError);
  }
},
async loginAzure(req, res) {

  let params = req.body;
  let headers = req.headers;
  const logger = req.logger;
  logger.info('Azure Request Data:' + params);

  let azureParams = {};
  azureParams['organizationId'] = params.organizationId; // for testing purpose only.
  azureParams['azureToken'] = params.azureToken;
  azureParams['userIp'] = utils.get_first_ip_from_header_value(headers['fastly-client-ip']) || utils.get_first_ip_from_header_value(headers['x-forwarded-for']) || '127.0.0.1';
  azureParams['userAgent'] = headers['user-agent'];

  try {
    const result = await authHelpers.login(azureParams);
    logger.info('AZURE RESULT:' + JSON.stringify(result.data));
    let sessionToken = result.data.data.sessionToken;
    let sessionPayload = jwt.decode(sessionToken);
    let sessionExpires = new Date(sessionPayload.exp * 1000 + (1000 * 60 * 60));
    res.cookie(JW_AUTH_KEY, sessionToken, {expires: sessionExpires, domain: JWT_DOMAIN, secure: true});
    let TRIMMED_REDIRECT_URL  = REDIRECT_URL.replace(/\/$/, '');
    logger.info(`AZURE REDIRECTING TO HOME: ${TRIMMED_REDIRECT_URL}`);
    res.redirect(TRIMMED_REDIRECT_URL);
  }
  catch(err) {
    let loggerError = err || 'Error with azure request';
    logger.error('Got an error with Azure login ', loggerError);
    res.status(err.response.status || 500).json(loggerError);
  }
},
async refresh_token(req, res) {

  let params = req.body;
  const logger = req.logger;
  try {
    const result = await authHelpers.refresh(params.token);
    res.status(result.status || 200).json(result.data);
  }
  catch(err) {
    let loggerError = err.response.data || 'Error trying to refresh auth token';
    logger.error('Got an error with refresh token', loggerError);
    res.status(err.response.status || 500).json(loggerError);
  }
  },

async canAccess(req, res) {
  let params = req.query,
      logger = req.logger,
      headers = req.headers;
  let authHeader = headers.authorization.split(' ')[1] !=undefined? headers.authorization.split(' ')[1]:'';
  try {
    const response = await authHelpers.access(params.type, params.identifier, authHeader);
    res.status(response.status || 200).json(response.data);
  }
  catch(err) {
    let loggerError = err.response.data || 'Error determing access for resource';
    logger.error('Got an error with fetching access ', loggerError);
    res.status(err.response.status || 500).json(loggerError);
  }
  },

async getSpecialtyYears(req, res) {

  let params = req.query;
  const logger = req.logger;
  let headers = req.headers;
  let result = {message: 'Successfully fetched years for specialty!'},
      errMsg = 'Failed to fetch available years';

  let specialty = params.specialty,
      fetch_params = {Bucket: config.get('PDF_ARCHIVE_BUCKET') || '', Prefix: specialty + '/', Delimiter: '/'};

  let token = headers.authorization.split(' ')[1] !=undefined? headers.authorization.split(' ')[1]:'';

  let specialtyCode = mlHelpers.translateSpecialityPath(specialty);

  try {
    const response = await authHelpers.access('archive', specialtyCode, token);
    if(response.data.data.accessRights.allow) {
      try {
        //Fetch thte list of all objects in the specified folder
        const data = await s3.listObjects(fetch_params).promise();
        let year_regex = new RegExp(/^[A-Za-z-]+\/(\d{4})\/$/);
        result.data = data.CommonPrefixes.map((prefix) => {
          return year_regex.exec(prefix.Prefix)[1];
        });
        res.status(200).json(result);
      }
      catch (err) {
        let loggerError = err.response.data;
        logger.error('Got an error with speciality year ', loggerError);
        res.status(err.response.status || 500).json(loggerError);
      }
    } else {
      let loggerError = {status: 'fail', data: {code: 'ForbiddenException', message: 'User is forbidden from accessing resource'}};
      logger.error('Got an error with speciality year ', loggerError);
      res.status(403).json(loggerError);
    }
  }
  catch(err) {
    let loggerError = err.response.data || errMsg;
    logger.error('Got an error with speciality year ', loggerError);
    res.status(err.response.status || 500).json(loggerError);
  }
},

  async getPrintIssues(req, res) {
  let params = req.query;
  const logger = req.logger;
  let headers = req.headers;
  let result = {message: 'Successfully fetched PDFs.'},
      errMsg = 'Failed to fetch PDFs from S3';

  let specialty = params.specialty,
      year = params.year,
      key = specialty + '/' + year + '/',
      fetch_params = {Bucket: config.get('PDF_ARCHIVE_BUCKET') || null, Prefix: key, Delimiter: '/'};

  let token = headers.authorization.split(' ')[1] !=undefined? headers.authorization.split(' ')[1]:'';

  let specialtyCode = mlHelpers.translateSpecialityPath(specialty);

  try {
    const response = await authHelpers.access('archive', specialtyCode, token);
    if(response.data.data.accessRights.allow) {
      try {
        //Fetch thte list of all objects in the specified folder
        const data = await s3.listObjects(fetch_params).promise();
        result.data = mlHelpers.sortPrintIssues(data);
        res.status(200).json(result);
      }
      catch (err) {
        let loggerError = err.response.data;
        logger.error('Got an error with print issues ', loggerError);
        res.status(err.response.status || 500).json(loggerError);
      }
    } else {
      let loggerError = {status: 'fail', data: {code: 'ForbiddenException', message: 'User is forbidden from accessing resource'}};
      logger.error('Got an error with print issues ', loggerError);
      res.status(403).json(loggerError);
    }
  }
  catch(err) {
    let loggerError = err.response.data || errMsg;
    logger.error('Got an error with print issues ', loggerError);
    res.status(err.response.status || 500).json(loggerError);
  }
}

}