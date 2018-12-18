'use strict';
/* exported Options */

const GLOBAL_KEYS = [];

class Options {
  constructor(songId) {
    this._songOptionsKey = `options_${songId}`;
    this._globalOptionsKey = 'options';
    this._loadPromise = this._load();

    // Default values
    this.scale = 1;
  }

  get ready() {
    return this._loadPromise;
  }

  async _load() {
    const optionsKeys = [this._songOptionsKey, this._globalOptionsKey];
    await new Promise((resolve, reject) => {
      chrome.storage.local.get(optionsKeys, result => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        for (const optionsKey of optionsKeys) {
          if (result[optionsKey]) {
            for (const key in result[optionsKey]) {
              this[key] = result[optionsKey][key];
            }
          }
        }
        resolve();
      });
    });
  }

  async save() {
    const values = {[this._songOptionsKey]: {}, [this._globalOptionsKey]: {}};
    for (const key in this) {
      if (!this.hasOwnProperty(key) || key.startsWith('_')) continue;
      const optionsKey = GLOBAL_KEYS.includes(key) ? this._globalOptionsKey : this._songOptionsKey;
      values[optionsKey][key] = this[key];
    }
    await new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve();
      });
    });
  }
}
