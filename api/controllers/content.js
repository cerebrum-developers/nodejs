'use strict';

// Dependant node modules

import { ContentfulHelper, ReplicaDisabledError } from '../helpers/contentful.helpers.js';

export default {

 async contentfulEntries(req, res) {
    const logger = req.logger;
    const contentfulHelper = new ContentfulHelper({logger});

  try {
    let params = req.query;

    // if (!params.contentID) {
    //   res.status(400).json({ success: false, message: 'missing content id' });
    //   return;
    // }

    const contentId = params.contentID || '';
    const contentType = params.contentType ? params.contentType : '';
    const includeMax = params.include ? params.include : 1;

    if (includeMax > 10 || includeMax < 0) {
      res.status(400).json({ success: false, message: 'incorrect value for include' });
      return;
    }
    
    await contentfulHelper.initRedisClient(err => {
      logger.error('Connection error', err);
    });

    // Looking up entries using 'sys.id' when content_type is not 'author'
    if (contentId !== '' && contentType !== 'author') {
      try {
        const result = await contentfulHelper.replicaGetEntryById(contentId, includeMax);
        res.status(200).json(result);
      }
      catch(err) {
        if (err instanceof ReplicaDisabledError) {
          const result = await contentfulHelper.contentfulFetchPage(contentId, contentType, includeMax);
          res.status(200).json(result);
        } else {
          logger.error('Got an error when retrieving from contentful', err);
          // fallback to calling Contentful directly at this point
          res.status(err.statusCode || 500).json(contentfulHelper.getError(err.message || 'Cannot fallback to Contentful'));
        }
      }
    }
    // Looking up entries using 'fields.authorId' when content_type is 'author'
    else if (contentId !== '' && contentType === 'author') {
      try {
        const result = await contentfulHelper.replicaGetEntryByAuthorId(contentId, includeMax);
        res.status(200).json(result);
      }
      catch(err) {
        if (err instanceof ReplicaDisabledError) {
          const result = await contentfulHelper.contentfulFetchAuthor(contentId, contentType, includeMax);
          res.status(200).json(result);
        } else {
          logger.error('Got an error when retrieving from contentful', err);
          // fallback to calling Contentful directly at this point
          res.status(err.statusCode || 500).json(contentfulHelper.getError(err.message || 'Cannot fallback to Contentful'));
        }
      }
    }
    // Looking up one or more entries by content_type only, i.e., 'sys.contentType.sys.id'
    else {
      try {
        const result = await contentfulHelper.replicaGetEntriesByContentType(contentType, includeMax);
        res.status(200).json(result);
      }
      catch(err) {
        if (err instanceof ReplicaDisabledError) {
          const result = await contentfulHelper.contentfulFetchContentType(contentType, includeMax);
          res.status(200).json(result);
        } else {
          logger.error('Got an error when retrieving from contentful', err);
          // fallback to calling Contentful directly at this point
          res.status(err.statusCode || 500).json(contentfulHelper.getError(err.message || 'Cannot fallback to Contentful'));
        }
      }
    }

    contentfulHelper.closeDown();
  }
  catch (err) {
    logger.error('Got an error in content search', err);
    res.status(err.statusCode || 500).json(contentfulHelper.getError(err.message || 'Error with search request'));
    contentfulHelper.closeDown();
  }
}
}

