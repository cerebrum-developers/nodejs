/**
 * Created by Danny on 9/7/17.
 */
'use strict';

import config from 'config';
import axios from 'axios';

const CONTENT_TRANSFORM_API = config.get('CONTENT_TRANSFORM_API');

async function getArticleHTML(doi, jwUrlBase, placeImagesAboveXref) {
    let uri_base = `${CONTENT_TRANSFORM_API}/transform/jw/${doi}`;
    const hasJwUrl = jwUrlBase && 0 < jwUrlBase.length;
    let uri_suffix = '';
    if(hasJwUrl && placeImagesAboveXref)
        uri_suffix = `?jwUrlBase=${encodeURIComponent(jwUrlBase)}&above=true`;
    else if(hasJwUrl)
        uri_suffix = `?jwUrlBase=${encodeURIComponent(jwUrlBase)}`;
    else if (placeImagesAboveXref)
        uri_suffix = '?above=true';

    let uri =    uri_base + uri_suffix

    let options = {
        method: 'GET',
        json: true,
        headers: {
                'x-api-key': config.get('CONTENT_TRANSFORM_KEY')
        }
    };

    const response =  await axios.get(uri, options);
    return response.data;
}

export default {
    getArticleHTML
}
