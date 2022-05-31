'use strict';

import config from 'config';

// Helper function to ensure we have the proper environment variables set.
function get(key, required) {
  let value = config.get(key);
  if (!value && required) {
    console.error(`Required environment variable: \'${key}\' was not set`);
    console.error('Currently set environment variables are: ', process.env);
    process.exit(1);
  }
  return value;
}

export default {
  get
}