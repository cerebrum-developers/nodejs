'use strict';

import uuidV4 from 'uuid/v4.js';
//Error response
function error(message, err, res, options) {
    const logger = options.logger ||options.reqLogger|| {};
    let status = err.statusCode || 500;
    let response = {
        "status": "fail",
        "data": {
            "code": "",
            "message":"",
            "errorId":uuidV4()
        }
    };

    //Error object does not convert to JSON directly.
    //Loop through error and add custom members to response 
    let error ={};
    for (let prop in err) {
        if (prop != "message" && prop != "stack") {
            error[prop] = err[prop];
        }
    }

    if(error.errors) {
        response.data.code = error.errors[0].code? error.errors[0].code:'';
        response.data.message = error.errors[0].message? error.errors[0].message:'';
        logger.error(message, response);

    } else {
        response.data.code = status;
        response.data.message = err.message;
        logger.error(message, err.message);
    }
    res.status(status).json(response);
}

function get_first_ip_from_header_value(headerValue) {
  if (headerValue) {
    return headerValue.split(',')[0]
  }

  return null;
}

export default {
    error,
    get_first_ip_from_header_value
}
