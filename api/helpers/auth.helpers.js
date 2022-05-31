'use strict';

import config from 'config';
import axios from 'axios';
import mlHelpers from './mark-logic.helpers.js';

const PRODUCT = 'jw';

let baseUri = config.get('AUTHN_API_URI');
let authz_uri = config.get('AUTHZ_API_URI');

async function login(params) {
  let uri = baseUri + '/v1/authenticate';

  params.clientId = config.get('CLIENT_ID');
  // Only send email and password if we have both, otherwise anoyn login.
  let options = {
    method: 'POST',
    json: true
  };
  return await axios.post(uri, params, options);

}

async function refresh(token) {
  let uri = baseUri + '/v1/refresh-token';
  let params = {
    token: token || ''
  };
  let options = {
    method: 'POST',
    json: true
  };
  return await axios.post(uri, params, options);

}

async function access(type, identifier, token) {
  let uri = authz_uri + '/v1/access-rights';
  let params = {};

  if(type == 'archive') {
    params.uri = [
      PRODUCT,
      type,
      'pdf',
      identifier
    ].join(':')
  } else {
    params.uri = [
      PRODUCT,
      type,
      identifier
    ].join(':');
  }

  let accessUrl = uri + '?' + mlHelpers.encodeUriParams(params);
  let options = {
    method: 'GET',
    headers: {
      'authorization': token
    },
    json: true
  };

  return  await axios.get(accessUrl, options);
}

export default {
  login,
  refresh,
  access
};