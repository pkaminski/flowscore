'use strict';
/* exported localOptions, saveOptions */

const OPTIONS_KEY = 'options';
const DEFAULT_LOCAL_OPTIONS = {scale: 1};

let localOptions;

init();

function init() {
  return chrome.storage.local.get(OPTIONS_KEY, result => {
    localOptions = result[OPTIONS_KEY] || DEFAULT_LOCAL_OPTIONS;
  });
}

function saveOptions() {
  chrome.storage.local.set({[OPTIONS_KEY]: localOptions});
}
