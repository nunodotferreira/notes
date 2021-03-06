import { reqPost, reqPut } from '../api';
import { tagByPrefix } from '../../utils/tags';

const utf8 = require('utf8');
const btoa = require('btoa');


export function listPages(backendName){
  console.log("listPages(", backendName, ")");
  let plaintags = ['type:md'];
  return reqPost('/rows/list', {"plaintags": plaintags}, backendName);
}

export function listPagesVersionedLatest(backendName){
  console.log("listPagesVersionedLatest(", backendName, ")");
  let plaintags = ['type:md'];
  return reqPost('/rows/list/versioned/latest', {"plaintags": plaintags}, backendName);
}

export function getPages(backendName, tags=[]){
  let plaintags = ['type:md'];
  plaintags = plaintags.concat(tags)
  return reqPost('/rows/get', {"plaintags": plaintags}, backendName);
}

export function getPagesVersionedLatest(backendName, tags=[]){
  let plaintags = ['type:md'];
  plaintags = plaintags.concat(tags)
  return reqPost('/rows/get/versioned/latest', {"plaintags": plaintags}, backendName);
}

export function createPage(title, contents, tags, backendName){
  let row = pageToPost(title, contents);
  row.plaintags = row.plaintags.concat(tags);
  return reqPost('/rows', row, backendName);
}

export function deletePagesByVersionID(versionID, backendName){
  // versionID is of the form 'id:...'
  let childVersionID = 'origversionrow:' + versionID;

  let origRow = {plaintags: [versionID]};
  let versionedRows = {plaintags: [childVersionID]};
  return reqPost('/rows/delete', origRow, backendName)
        .then(resp => {
          if (resp.error === '' || resp.status === 201 || resp.status === 404){
            return resp;
          }
          throw new Error(`Got response of ${resp.status}, wanted 201`);
        })
        .then(() => {
          return reqPost('/rows/delete', versionedRows, backendName)
        })
}

function pageToPost(title, contents){
  let titleCleaned = title.replace(/\.md$/, '');
  return {
    unencrypted: btoa(utf8.encode(contents || '')),
    plaintags: ['type:text', 'type:md',
                'type:file', `filename:${titleCleaned}.md`]
  }
}

function pageToPut(pageKey, title, contents){
  // TODO: Acknowledge new title
  return {
    unencrypted: btoa(utf8.encode(contents || '')),
    old_version_id_tag: pageKey
  }
}

// Create, Update

export function updatePage(pageKey, title, contents, backendName){
  let row = pageToPut(pageKey, title, contents);
  return reqPut('/rows', row, backendName);
}

export function updatePageSmart(pageKey, title, contents, tags, backendName){
  // TODO: Considering adding CreateSmartRow endpoint to cryptagd so
  // that removing the default tags (id:..., created:..., all) is
  // unnecessary to manually do here.

  // Remove tags we're about to re-add (prevversionrow:..., ), and
  // ones that will be added by cryptagd (id:..., created:..., all).
  let newTags = tags.filter(
      t => !t.startsWith('prevversionrow:') &&
          !t.startsWith('title:') &&
          !t.startsWith('filename:') &&
          !t.startsWith('id:') &&
          !t.startsWith('created:') &&
          t !== 'all'
  );
  // Tie this new note to its previous version -- if it it exists --
  // by tag (rather than just timestamp, which is susceptible to race
  // conditions, which is important for multi-user real-time editing.)
  if (pageKey){
    newTags.push('prevversionrow:'+pageKey)
  }

  let titleCleaned = title.replace(/\.md$/, '');

  // Update title:... tag if it exists, even though we're
  if (tagByPrefix(tags, 'title:') !== ''){
    newTags.push('title:'+titleCleaned)
  }

  // If we're updating the first version of a note, then we didn't
  // copy the (non-existent) 'origversionrow:...' tag from it, and
  // therefore must add it here.
  if (tagByPrefix(tags, 'origversionrow:') == ''){
    newTags.push('origversionrow:'+pageKey)
  }

  let row = {
    unencrypted: btoa(utf8.encode(contents || '')),
    plaintags: newTags.concat([`filename:${titleCleaned}.md`])
  }

  return reqPost('/rows', row, backendName);
}
