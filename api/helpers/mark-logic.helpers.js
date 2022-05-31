'use strict';

import config from 'config';
import axios from 'axios';
import { DOMParser } from 'xmldom';
import contentHelper from './content.helpers.js';

// Mark Logic configuration values.
const ML_API_VERSION = 'v1';
const ML_API_CLASS = 'jwatch';
const ML_DOI_PREFIX = '10.1056';


function encodeUriParams(data) {
  return Object.keys(data).map((key) => {
    return [key, data[key]].map(encodeURIComponent).join('=');
  }).join('&');
}


function hasNestedProperty(obj) {
  let args = Array.prototype.slice.call(arguments, 1);
  for (let i = 0; i < args.length; ++i) {
    if (!obj || !obj.hasOwnProperty(args[i])) {
      return false;
    }
    obj = obj[args[i]];
  }
  return !!obj;
}

function dateToStr(date) {
  if (date) {
    let yearStr = date.getFullYear().toString();
    // Make sure to pad the month + day to two characters.
    let monthStr = ('0' + (date.getMonth() + 1).toString()).slice(-2);
    let dayStr = ('0' + date.getDate().toString()).slice(-2);

    return [yearStr, monthStr, dayStr].join('-');
  }
  return undefined;
}

function translateJWSpecialityCode(specialty) {
  // All of the below mappings were pulled from:
  // http://marklogic-dev.mms.org:9095/jwatch/search/
  switch(specialty) {
    case 100:
    //case 'Cardiology':
      return 'jwc';
    case 101:
    //case 'Dermatology':
      return 'jwd';
    case 102:
    //case 'Emergency':
      return 'jwe';
    case 103:
    //case 'Gastroenterology':
      return 'jwg';
    case 104:
    //case 'General Medicine':
      return 'jwa';
    case 105:
    //case 'HIV/AIDS Clinical Care':
      return 'acc';
    case 106:
    //case 'Hospital Medicine':
      return 'jhm';
    case 107:
    //case 'Infectious Diseases':
      return 'jwi';
    case 108:
    //case 'Neurology':
      return 'jwn';
    case 109:
    //case 'Oncology and Hematology':
      return 'joh';
    case 110:
    //case 'Pediatrics and Adolescent Medicine':
      return 'jpa';
    case 111:
    //case 'Physician\'s First Watch':
      return 'pfw';
    case 112:
    //case 'Psychiatry':
      return 'jwp';
    case 113:
    //case 'Women\'s Health':
      return 'jww';
  }
  return undefined;
}

function translateSpecialityPath(speciality) {
  switch(speciality) {
    case 'cardiology':
      return 'jwc';
    case 'dermatology':
      return 'jwd';
    case 'emergency-medicine':
      return 'jwe';
    case 'gastroenterology':
      return 'jwg';
    case 'general-medicine':
      return 'jwa';
    case 'hiv-aids':
      return 'acc';
    case 'hospital-medicine':
      return 'jhm';
    case 'infectious-diseases':
      return 'jwi';
    case 'neurology':
      return 'jwn';
    case 'oncology-and-hematology':
      return 'joh';
    case 'pediatrics-and-adolescent-medicine':
      return 'jpa';
    case 'physicians-first-watch':
      return 'pfw';
    case 'psychiatry':
      return 'jwp';
    case 'womens-health':
      return 'jww';
    default:
      console.error('Could not find code for speciality: ', speciality);
      return null;
  }
}

/**
 * This function now hits an API which can cache requests, the below still takes place but now resides on
 * the content-transform-api
 *
 * This calls remote apis and then assembles all xml pieces together and then run it through xslt transformation.
 * @param {string} doi - required. article DOI, example: 10.1056/nejm-jw.NA43423
 * @param {string} jwUrlBase - optional. if not falsy, xslt will use this host value to build article and editor links. Otherwise xslt uses default host http://www.jwatch.org
 * @param {boolean} placeImagesAboveXref - optional. Controls placement of images. if false, xslt will not place image elements above referencing paragraph.
 * @return {string} article html
 */
async function getArticleHTML(doi, jwUrlBase, placeImagesAboveXref) {
  return await contentHelper.getArticleHTML(doi, jwUrlBase, placeImagesAboveXref);
}


//Extract author notes node from getCOI payload
async function getAuthorNotes(doi) {
  const coi = await getCOI(doi);
  //Remove namespace
  let coiEdited = coi.replace(' xmlns="http://jwatch.org/mr-french/article-meta"', '');

  let coiDoc = new DOMParser().parseFromString(coiEdited, 'text/xml');
  let authorNotes = coiDoc.getElementsByTagName('article-meta')[0];
  let name = 'author-notes';

  //Change parent element name
  authorNotes.localName = name;
  authorNotes.tagName = name;
  authorNotes.nodeName = name;

  return authorNotes;
}

async function filterGuestAuthor(doi, contributors) {
  const coi = await getCOI(doi);
  let coiDoc = new DOMParser().parseFromString(coi, 'text/xml');
  let authors = coiDoc.getElementsByTagName('author');
  let authorIds = Object.keys(authors).filter((key) => {
    return authors[key].nodeName == 'author';
  }).map((key) => {
    return authors[key].getElementsByTagName('id')[0];
  }).filter((id) => {
    return !!id.firstChild;
  }).map((id) => {
    console.log('ID:', id.toString());
    return id.firstChild.data
  });

  if(contributors.length < 1) return;

  contributors.forEach((contributor, idx) => {
    let authorId = contributor.getAttribute('xlink:href');
    if(!authorIds.includes(authorId)) {
      contributor.setAttribute('xlink:href', '');
    }
  });
}

async function getMETS(metsDOI, format) {
    let uri = config.get('CONTENT_API_URI') + '/v1/object/getMETS';
    let uriParams = {
        'mets-doi': ML_DOI_PREFIX + '/' + metsDOI,
        'format': format || 'xml'
    };
    uri += '?' + encodeUriParams(uriParams);

    let options = {
        method: 'GET',
        json: true,
        headers: {
            'x-api-key': config.get('ML_CONTENT_API_KEY') || ''
        }
    };

    const response =  await axios.get(uri, options);
    return response.data;
}

// Extract video & audio info from METS
async function getMedia(articleDoi) {
  let uri = config.get('CONTENT_API_URI') + '/v1/object/getMETS';
  let uriParams = {
    'related-doi': articleDoi,
    'format': 'json'
  };
  uri += '?' + encodeUriParams(uriParams);

  let options = {
    method: 'GET',
    json: true,
    headers: {
      'x-api-key': config.get('ML_CONTENT_API_KEY') || ''
    }
  };

  try {
    const response =  await axios.get(accessUrl, options);
    let media = [];
    let videos = response.data.mets.filter(video => video.dmdSec.mdWrap.xmlData.mods.typeOfResource == "moving image");
    let audios = response.data.mets.filter(audio => audio.dmdSec.mdWrap.xmlData.mods.typeOfResource == "sound recording"); 

    //Videos
    for (let video of videos) {
      let title = video.dmdSec.mdWrap.xmlData.mods.titleInfo.title;
      let caption = video.dmdSec.mdWrap.xmlData.mods.note[0]._value
      let file = video.fileSec.fileGrp[0].file[0].FLocat.href;
      
      media.push({ "title": title, "caption": caption, "file": "https:" + file })
    }

    //Audio files -- always after videos
    for (let audio of audios) {
      let title = audio.dmdSec.mdWrap.xmlData.mods.titleInfo.title;
        let caption = audio.dmdSec.mdWrap.xmlData.mods.note[0]._value
      let file = audio.fileSec.fileGrp[0].file[0].FLocat.href;
      
      media.push({ "title": title, "caption": caption, "file": "https:" + file })
    }

    return media;
  }
  catch(err) {
    if (err.statusCode == 404) {
      return [];
    } else {
      throw err;
    }
  }
}

function s3ToHttp(href) {
  if (href && href.startsWith('s3://')) {
    return href.replace(/s3:\/\//i, config.get('METS_S3_HTTP_PREFIX') || 'https://s3.amazonaws.com/');
  } else {
    return href;
  }
}


// Get COI disclosure from MarkLogic Author API
async function getCOI(doi) {
  let uri = config.get('AUTHOR_API_URI') + '/v1/jwatch/getCOI?doi=' + encodeURI(doi);
  let options = {
    method: 'GET',
    uri: uri,
    headers: { 'x-api-key': config.get('ML_AUTHOR_API_KEY') || '' }
  }

  const response =  await axios.get(accessUrl, options);
  return response.data;
}

function sortPrintIssues(issues) {
    return issues.Contents.map((issue) => {
        return issue.Key.split('/').reverse()[0].replace('.pdf', '');
    }).sort((a,b) => {

        let sorting_regex = new RegExp(/No\.?\ ?(\d+)/);


        let x = parseInt(sorting_regex.exec(a)[1]);
        let y = parseInt(sorting_regex.exec(b)[1]);
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

//Rename table objects so they are treated as figures. table-wrap -> fig
function renameTables(nodes) {
  if (nodes && nodes.length > 0) {
    let figure = 'fig';
    for (let node of nodes) {
      node.localName = figure;
      node.tagName = figure;
      node.nodeName = figure;
    }
  }

}

function formatSearchResult(data) {
  let results = data.data.result.map((article) => {

    let italicRegEx = /<italic[^>]*>(.*)<\/italic>/g;
    let ltRegEx = /&lt;/g;
    let gtRegEx = /&gt;/g;
    //Format title
    let titleScrubberRegEx = /<\/?(?!(?:italic)\b)[a-z](?:[^>"']|"[^"]*"|'[^']*')*>/g;
    
    //Encode sub/super scripted characters.

    article.title = article.title.replace(/<sub[^>]*>/g, "&lt;sub&gt;");
    article.title = article.title.replace(/<\/sub>/g, "&lt;/sub&gt;");
    article.title = article.title.replace(/<sup[^>]*>/g, "&lt;sup&gt;");
    article.title = article.title.replace(/<\/sup>/g, '&lt;/sup&gt;');

    article.title = article.title.replace(titleScrubberRegEx, "");
    article.title = article.title.replace(italicRegEx, "<i>$1</i>");
    //Decode sub/super scripted characters. 
    article.title = article.title.replace(gtRegEx, '>');
    article.title = article.title.replace(ltRegEx, '<');
    
    //Format abstracts
    let abstractScrubberRegEx = /<\/?(?!(?:italic|bold)\b)[a-z](?:[^>"']|"[^"]*"|'[^']*')*>/g;
    let boldRegEx = /<bold[^>]*>(.*)<\/bold>/;
    let abstracts = [];   

    for (let abstract of article.abstracts.abstract) {

      abstract = abstract.replace(/<sub[^>]*>/g, "&lt;sub&gt;");
      abstract = abstract.replace(/<\/sub>/g, "&lt;/sub&gt;");
      abstract = abstract.replace(/<sup[^>]*>/g, "&lt;sup&gt;");
      abstract = abstract.replace(/<\/sup>/g, '&lt;/sup&gt;');

      abstract = abstract.replace(abstractScrubberRegEx, "");
      abstract = abstract.replace( /<italic[^>]*>/g,"<i>");
      abstract = abstract.replace(/<\/italic>/g, "</i>");
      abstract = abstract.replace(boldRegEx, "<b>$1</b>");
      abstract = abstract.replace(gtRegEx, '>');
      abstract = abstract.replace(ltRegEx, '<');
      abstracts.push(abstract);      
    }

    article.abstracts.abstract = abstracts;
    return article;
  });

  return results;
}

export default {
  ML_API_VERSION,
  ML_API_CLASS,
  ML_DOI_PREFIX,
  encodeUriParams,
  hasNestedProperty,
  dateToStr,
  translateJWSpecialityCode,
  translateSpecialityPath,
  getMETS,
  s3ToHttp,
  getCOI,
  getAuthorNotes,
  getArticleHTML,
  formatSearchResult,
  sortPrintIssues,
};
