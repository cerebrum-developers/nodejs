'use strict';

import config from 'config';
import bluebird from 'bluebird';
import * as redis from 'redis';
import * as contentful from 'contentful';

export class ContentfulHelper {
  constructor(option) {
    // Private
    this.redisclient = null;
    this.logger = option.logger ||{};
    this.redisHost = config.get('REDIS_HOST') || '';
    this.replicaPrefix = config.get('CONTENTFUL_REDIS_PREFIX') || '';
    this.cacheTtl = Number.parseInt(config.get('CACHE_TTL') || '-1', 10);
    this.cachePrefix = config.get('CACHE_REDIS_PREFIX') || '';
    this.contentfulSpace = config.get('CONTENTFUL_SPACE') || '';
    this.contentfulToken = config.get('CONTENTFUL_TOKEN') || '';
    try {
      this.replicaEnabled();
      bluebird.promisifyAll(redis);
    }
    catch (e) {
      if (e instanceof ReplicaDisabledError) {
        this.cacheTtl = 30;
      }
    }
  }

  async initRedisClient(errorCallback) {
    let self = this;
    const logger = self.logger;

    if (!self.redisclient) {
      if (this.redisHost != '') {
        self.redisclient = redis.createClient(this.redisHost, {
          retry_strategy: function (options) {
            logger.debug(`Redis retry_strategy`, options);
            if (options.attempt > 10) {
              self.redisclient = null;
              // report error using callback
              let message = `The server refused the connection`;
              if (options.error && options.error.code) {
                message = `The server refused the connection. Code ${options.error.code}`;
              }
              logger.error(`Redis retry_strategy error detected  ${message}`);

              if (errorCallback) {
                errorCallback(message);
              }
              // End reconnecting with built in error
              return undefined;
            }
            // reconnect after
            return Math.min(options.attempt * 100, 3000);
          }
        });

        self.redisclient.on('ready', () => {
          //logger.info(`Ready for redis`);
        });
        self.redisclient.on('connect', () => {
          //logger.info(`Connected to redis`);
        });
        self.redisclient.on('end', () => {
          //logger.info(`Ending connection to redis`);
        });
        self.redisclient.on('reconnecting', () => {
          logger.warn(`Reconnecting to redis`);
        });
        self.redisclient.on('error', err => {
          console.log('err',err)
          logger.error(`Redis error detected ${err.message}`);
        });
      }
      else {
        logger.warn(`Redis connectiong string not available`);
      }
    }
  }

  closeDown() {
    // close down causes unintended issues
    // if (this.rediisclient) {
    //   let rc = this.redisclient;
    //   this.redisclient = null;
    //   logger.error('Quitting redis connection');
    //   return rc.quitAsync();
    // }
  }

  async getCacheValue(key) {
    this.cachingEnabled();

    return await this.redisclient.getAsync(key);
  }

  async setCacheValue(key, value, ttl) {
    if (ttl > 0) {
      await this.redisclient.setAsync(key, value, 'EX', ttl);
    }
    else {
      await this.redisclient.setAsync(key, value);
    }
  }

  // Iterate over fields of an entry/asset and reolve the field values
  async resolveFields(entry, includeMax, includedEntries, includedAssets) {
    try {
      await Promise.all(
        Object.keys(entry.fields).map(async fieldName => {
          const fieldValue = entry.fields[fieldName];

          const result = await this.resolve(fieldValue, includeMax, includedEntries, includedAssets);
          entry.fields[fieldName] = result.content;
        })
      );

      return {content: entry, includedEntries, includedAssets};
    } 
    catch (err) {
      this.logger.error('Error resolving fields', JSON.stringify({error: err, entry: entry }));
      return {content: entry, includedEntries, includedAssets};
    }
  }

  // Iterate over array of an entry/asset and reolve the all items
  async resolveArray(entryArray, includeMax, includedEntries, includedAssets) {
    try {
      await Promise.all(
        entryArray.map(async (arrayItem, arrayIndex) => {
          const result = await this.resolve(arrayItem, includeMax, includedEntries, includedAssets);
          
          entryArray[arrayIndex] = result.content;
          includedEntries = result.includedEntries;
          includedAssets = result.includedAssets;
      }));

      return {content: entryArray, includedEntries, includedAssets};
    } 
    catch (err) {
      this.logger.error('Error resolving array', JSON.stringify({error: err, entry: entryArray }));
      return {content: entryArray, includedEntries, includedAssets};
    }
  }

  // Recursive function used to resolve links
  async resolve(content, includeMax, includedEntries, includedAssets) {
    try {
      // no more need to resolve, reached max level
      if (includeMax == 0) {
        return {content, includedEntries, includedAssets};
      }

      // content is an array, so resolve all of them
      if (Array.isArray(content)) {
        return await this.resolveArray(content, includeMax, includedEntries, includedAssets);
      }

      // content is an entry or asset with fields, so check for all fields if they are a link
      if (
        content &&
        content.sys &&
        (content.sys.type === 'Entry' || content.sys.type === 'Asset')
      ) {
        return await this.resolveFields(content, includeMax, includedEntries, includedAssets);
      }

      // Content is a reference to another entry, so return that other entry
      // Also add unresolved entry to response object includes.Entry array
      if (
        content &&
        content.sys &&
        content.sys.type === 'Link' &&
        content.sys.linkType === 'Entry'
      ) {
        // get the linked entry from redis here using id content.sys.id
        // and the need to resolve this entry too
        return await this.getEntryBySysId(content.sys.id, includeMax - 1, includedEntries, includedAssets, true);
      }

      // Content is reference to an asset, so return that asset.
      // Also add unresolved asset to response object includes.Asset array
      if (
        content &&
        content.sys &&
        content.sys.type === 'Link' &&
        content.sys.linkType === 'Asset'
      ) {
        // get the linked entry from redis here using id content.sys.id
        // and the need to resolve this entry too
        return await this.getAssetBySysId(content.sys.id, includeMax - 1, includedEntries, includedAssets, true);
      }
  
      // content is a value, so return it
      return {content, includedEntries, includedAssets};
    } 
    catch (err) {
      this.logger.error('Error resolving', JSON.stringify({ error: err, content: content, level: includeMax }));
      // Don't throw error since a missing entry is probably better than crashing the program
      return {content: null, includedEntries, includedAssets};
    }
  }

  async getEntryBySysId(contentSysId, includeMax, includedEntries, includedAssets, include) {
    includedEntries = includedEntries || [];
    includedAssets = includedAssets || [];
    includeMax = includeMax < 0 ? 1 : includeMax;

    if (!contentSysId) {
      return {content: null, includedEntries, includedAssets};
    }

    this.logger.debug('Getting redis key', { key: `${this.replicaPrefix}:entry:${contentSysId}` });
    const entryJsonString = await this.redisclient.getAsync(`${this.replicaPrefix}:entry:${contentSysId}`);
    if (entryJsonString) {
      let entry = JSON.parse(entryJsonString);

      if (include === true) {
        includedEntries.push(entry);
      }

      if (includeMax > 0) {
        return await this.resolve(entry, includeMax, includedEntries, includedAssets);
      }

      return {content: entry, includedEntries, includedAssets};
    }

    return {content: null, includedEntries, includedAssets};
  }

  async getAssetBySysId(contentSysId, includeMax, includedEntries, includedAssets, include) {
    includedEntries = includedEntries || [];
    includedAssets = includedAssets || [];
    includeMax = includeMax < 0 ? 1 : includeMax;

    if (!contentSysId) {
      return {content: null, includedEntries, includedAssets};
    }

    this.logger.debug('Getting redis key', { key: `${this.replicaPrefix}:asset:${contentSysId}` });
    const assetJsonString = await this.redisclient.getAsync(`${this.replicaPrefix}:asset:${contentSysId}`);
    if (assetJsonString) {
      let asset = JSON.parse(assetJsonString);

      if (include === true) {
        includedAssets.push(asset);
      }

      if (includeMax > 0) {
        return await this.resolve(asset, includeMax, includedEntries, includedAssets);
      }

      return {content: asset, includedEntries, includedAssets};
    }

    return {content: null, includedEntries, includedAssets};
  }

  async replicaGetEntryById(contentId, includeMax) {
    // check in cache first
    const cacheKey = `${this.cachePrefix}:${contentId}/${includeMax}`;

    try {
      const result = await this.getCacheValue(cacheKey);
      return this.prepCacheEntry(result);
    }
    catch (e) {
      if (e instanceof CachingDisabledError) {
        return await this.getEntryByIdFromReplica(contentId, includeMax);
      }
      else if (e instanceof CacheMissError) {
        return await this.getEntryByIdFromReplica(contentId, includeMax, cacheKey);
      }

      throw e;
    }
  }

  async getEntryByIdFromReplica(contentId, includeMax, cacheKey) {
    this.replicaEnabled();

    let response = {
      _source: 'replica',
      sys: {
        type: 'Array'
      },
      total: 0,
      skip: 0,
      limit: 100,
      items: [],
      includes: {
        Entry: [],
        Asset: []
      }
    };
    
    this.logger.debug('cache miss for key', {key: cacheKey});
    const resolvedEntry = await this.getEntryBySysId(contentId, includeMax);

    if (resolvedEntry && resolvedEntry.content) {
      response.items.push(resolvedEntry.content);
      response.total = 1;
    }
    if (resolvedEntry && resolvedEntry.includedEntries) {
      response.includes.Entry = resolvedEntry.includedEntries;
    }
    if (resolvedEntry && resolvedEntry.includedAssets) {
      response.includes.Asset = resolvedEntry.includedAssets;
    }

    // cache resolved entry
    if (cacheKey && this.isCachingEnabled()) {
      setImmediate(() => {
        this.setCacheValue(cacheKey, JSON.stringify(response), this.cacheTtl);
      });
    }

    return response;
  }

  async replicaGetEntryByAuthorId(contentAuthorId, includeMax) {
    // check in cache first
    const cacheKey = `${this.cachePrefix}:${contentAuthorId}/${includeMax}`;

    try {
      const result = await this.getCacheValue(cacheKey);
      return this.prepCacheEntry(result);
    }
    catch (e) {
      if (e instanceof CachingDisabledError) {
        return await this.getByAuthorIdFromReplica(contentAuthorId, includeMax);   
      }
      else if (e instanceof CacheMissError) {
        return await this.getByAuthorIdFromReplica(contentAuthorId, includeMax, cacheKey);   
      }

      throw e;
    }
  }

  async getByAuthorIdFromReplica(contentAuthorId, includeMax, cacheKey) {
    this.replicaEnabled();

    let response = {
      _source: 'replica',
      sys: {
        type: 'Array'
      },
      total: 0,
      skip: 0,
      limit: 100,
      items: [],
      includes: {
        Entry: [],
        Asset: []
      }
    };

    this.logger.debug('cache miss for key', {key: cacheKey});

    //  hget
    this.logger.debug('Getting redis hash', { key: `${this.replicaPrefix}:authorIds`, name: contentAuthorId });
    const authorEntryId = await this.redisclient.hgetAsync(`${this.replicaPrefix}:authorIds`, contentAuthorId);
    this.logger.debug('Got redis hash value', authorEntryId);
    const resolvedEntry = await this.getEntryBySysId(authorEntryId, includeMax);

    if (resolvedEntry && resolvedEntry.content) {
      response.items.push(resolvedEntry.content);
      response.total = 1;
    }
    if (resolvedEntry && resolvedEntry.includedEntries) {
      response.includes.Entry = resolvedEntry.includedEntries;
    }
    if (resolvedEntry && resolvedEntry.includedAssets) {
      response.includes.Asset = resolvedEntry.includedAssets;
    }
    
    // cache resolved entry
    if (cacheKey && this.isCachingEnabled()) {
      setImmediate(() => {
        this.setCacheValue(cacheKey, JSON.stringify(response), this.cacheTtl);
      });
    }
    return response;
  }

  async replicaGetEntriesByContentType(contentType, includeMax) {
    // check in cache first
    const cacheKey = `${this.cachePrefix}:${contentType}/${includeMax}`;

    try {
      const result = await this.getCacheValue(cacheKey);
      return this.prepCacheEntry(result);
    }
    catch (e) {
      if (e instanceof CachingDisabledError) {
        return await this.getEntriesByContentTypeFromReplica(contentType, includeMax);
      }
      else if (e instanceof CacheMissError) {
        return await this.getEntriesByContentTypeFromReplica(contentType, includeMax, cacheKey);
      }

      throw e;
    }
  }

  async getEntriesByContentTypeFromReplica(contentType, includeMax, cacheKey) {
    this.replicaEnabled();

    let response = {
      _source: 'replica',
      sys: {
        type: 'Array'
      },
      total: 0,
      skip: 0,
      limit: 100,
      items: [],
      includes: {
        Entry: [],
        Asset: []
      }
    };

    this.logger.debug('cache miss for key', {key: cacheKey});

    let resolvedEntries = [];
    let entries = [];
    let assets = [];

    // lget
    this.logger.debug('Getting redis list', { key: `${this.replicaPrefix}:contentType:${contentType}` });
    const contentEntriesIds = await this.redisclient.lrangeAsync(`${this.replicaPrefix}:contentType:${contentType}`, 0, -1);
    this.logger.debug('Got redis list value', contentEntriesIds);

    if (contentEntriesIds && Array.isArray(contentEntriesIds)) {
      await Promise.all(contentEntriesIds.map(async contentEntriesId => {
        const result = await this.getEntryBySysId(contentEntriesId, includeMax);

        if (result && result.content) {
          resolvedEntries.push(result.content);
        }
        if (result && result.includedEntries) {
          result.includedEntries.forEach(item => entries.push(item));
        }
        if (result && result.includedAssets) {
          result.includedAssets.forEach(item => assets.push(item));
        }
      }));

      if (resolvedEntries && Array.isArray(resolvedEntries)) {
        response.items = resolvedEntries.length > 100 ? resolvedEntries.slice(0, 100) : resolvedEntries;
        response.total = resolvedEntries.length;
      }
      if (entries) {
        response.includes.Entry = entries;
      }
      if (assets) {
        response.includes.Asset = assets;
      }

      if (cacheKey && this.isCachingEnabled()) {
        setImmediate(() => {
          this.setCacheValue(cacheKey, JSON.stringify(response), this.cacheTtl);
        });
      }
      return response;
    }

    if (cacheKey && this.isCachingEnabled()) {
      setImmediate(() => {
        this.setCacheValue(cacheKey, JSON.stringify(response), this.cacheTtl);
      });
    }
    return response;
  }

  getError(message) {
    // Standard error response format matching Contentful. This is also used when no matching content is found
    let errResponse = {
      sys: {
        type: 'Array'
      },
      total: 0,
      skip: 0,
      limit: 100,
      errors: [],
    };

    errResponse.errors.push(message);
    errResponse.total = 1;

    return errResponse;
  }

  replicaEnabled() {
    const isReplicaEnabled = this.redisHost != '' && this.replicaPrefix != '';

    if (!isReplicaEnabled) {
      throw new ReplicaDisabledError();
    }
  }

  fallbackEnabled() {
    const isContentfulFallbackEnabled = this.contentfulSpace != '' && this.contentfulToken != '';

    if (!isContentfulFallbackEnabled) {
      throw new FallbackDisabledError();
    }
  }

  cachingEnabled() {
    if (!this.isCachingEnabled()) {
      throw new CachingDisabledError();
    }
  }

  isCachingEnabled() {
    // if CACHE_REDIS_PREFIX is empty, it means do not use caching
    return this.redisHost != '' && this.cachePrefix != '';
  }

  prepCacheEntry(value) {
    if (value) {
      let resolvedEntry = JSON.parse(value);
      resolvedEntry._source = 'cache';
      return resolvedEntry;
    }

    throw new CacheMissError();
  }

  async contentfulFetchPage(contentId, contentType, includeMax) {
    // check in cache first
    const cacheKey = `${this.cachePrefix}:${contentId}/${includeMax}`;

    try {
      const result = await this.getCacheValue(cacheKey);
      return this.prepCacheEntry(result);
    }
    catch (e) {
      if (e instanceof CachingDisabledError) {
        return await this.contentfulFetchPageHelper(contentId, contentType, includeMax);
      }
      else if (e instanceof CacheMissError) {
        return this.contentfulFetchPageHelper(contentId, contentType, includeMax, cacheKey);
      }

      throw e;
    }
  }

  async contentfulFetchAuthor(authorId, contentType, includeMax) {
    // check in cache first
    const cacheKey = `${this.cachePrefix}:${authorId}/${includeMax}`;

    try {
      const result = await this.getCacheValue(cacheKey);
      return this.prepCacheEntry(result);
    }
    catch (e) {
      if (e instanceof CachingDisabledError) {
        return await this.contentfulFetchAuthorHelper(authorId, contentType, includeMax);
      }
      else if (e instanceof CacheMissError) {
        return await this.contentfulFetchAuthorHelper(authorId, contentType, includeMax, cacheKey);
      }

      throw e;
    }
  }

  async contentfulFetchContentType(contentType, includeMax) {
    // check in cache first
    const cacheKey = `${this.cachePrefix}:${contentType}/${includeMax}`;

    try {
      const result = await this.getCacheValue(cacheKey);
      return this.prepCacheEntry(result);
    }
    catch (e) {
      if (e instanceof CachingDisabledError) {
        return await this.contentfulFetchContentTypeHelper(contentType, includeMax);
      }
      else if (e instanceof CacheMissError) {
        return await this.contentfulFetchContentTypeHelper(contentType, includeMax, cacheKey);
      }

      throw e;
    }
  }

  async contentfulFetchPageHelper(contentId, contentType, includeMax, cacheKey) {
    this.fallbackEnabled();

    let client = contentful.createClient({
      space: this.contentfulSpace,
      accessToken: this.contentfulToken
    });

    try {
      const result = await client.getEntries({
        'include': includeMax,
        'sys.id': contentId,
        'content_type': contentType
      });
      
      if (cacheKey && this.isCachingEnabled()) {
        setImmediate(() => {
          this.setCacheValue(cacheKey, JSON.stringify(result), this.cacheTtl);
        });
      }

      return result;
    }
    catch(err)  {
      this.logger.error('Got an error when retrieving from contentful', err.message);
      // fallback to calling Contentful directly at this point
      throw err;
    }
  }

  async contentfulFetchAuthorHelper(authorId, contentType, includeMax, cacheKey) {
    this.fallbackEnabled();
    
    let client = contentful.createClient({
      space: this.contentfulSpace,
      accessToken: this.contentfulToken
    });

    try {
      const result = await client.getEntries({
        'include': includeMax,
        'fields.authorId': authorId,
        'content_type': contentType
      });

      if (cacheKey && this.isCachingEnabled()) {
        setImmediate(() => {
          this.setCacheValue(cacheKey, JSON.stringify(result), this.cacheTtl);
        });
      }

      return result;
    }
    catch(err) {
      this.logger.error('Got an error when retrieving from contentful', err.message);
      // fallback to calling Contentful directly at this point
      throw err;
    }
  }

  async contentfulFetchContentTypeHelper(contentType, includeMax, cacheKey) {
    this.fallbackEnabled();
    
    let client = contentful.createClient({
      space: this.contentfulSpace,
      accessToken: this.contentfulToken
    });

    try {
      const result = await client.getEntries({
        'include': includeMax,
        'content_type': contentType
      });

      if (cacheKey && this.isCachingEnabled()) {
        setImmediate(() => {
          this.setCacheValue(cacheKey, JSON.stringify(result), this.cacheTtl);
        });
      }

      return result;
    }
    catch(err) {
      this.logger.error('Got an error when retrieving from contentful', err.message);
      // fallback to calling Contentful directly at this point
      throw err;
    }
  }
}

export class ReplicaDisabledError extends Error {
  constructor(...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReplicaDisabledError);
    }
  }
}

export class CachingDisabledError extends Error {
  constructor(...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CachingDisabledError);
    }
  }
}

export class FallbackDisabledError extends Error {
  constructor(...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FallbackDisabledError);
    }
  }
}

export class CacheMissError extends Error {
  constructor(...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CacheMissError);
    }
  }
}
