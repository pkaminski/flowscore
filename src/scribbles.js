'use strict';
/* exported Scribbles SVG_NAMESPACE */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';


class Scribbles {
  constructor(songId) {
    this._songId = songId;
    this._scribbles = undefined;
    this._ready = this._load();
  }

  get ready() {
    return this._ready;
  }

  async _load() {
    this._scribbles = await new Promise((resolve, reject) => {
      chrome.storage.local.get(this._songId, items => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const entry = items[this._songId];
          try {
            resolve((entry ? JSON.parse(LZString.decompressFromUTF16(entry)) : {}) || {});
          } catch (e) {
            reject(e);
          }
        }
      });
    });
  }

  _save() {
    const payload = LZString.compressToUTF16(JSON.stringify(this._scribbles));
    // console.log('annotation payload size:', payload.length * 2 + this._songId.length);
    chrome.storage.local.set(
      {[this._songId]: payload},
      () => {
        if (chrome.runtime.lastError) {
          alert('Failed to save annotations: ' + chrome.runtime.lastError);
        }
      }
    );
  }

  _render(svg, scribbleId, withId) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    if (withId) path.id = scribbleId;
    path.setAttribute('class', 'flowscore-scribble');
    path.setAttribute('d', this._scribbles[scribbleId]);
    svg.appendChild(path);
  }

  async renderAll(svg, withIds) {
    await this._ready;
    for (const scribbleId in this._scribbles) {
      this._render(svg, scribbleId, withIds);
    }
  }

  async renderPassive() {
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('class', 'flowscore-annotations');
    await this.renderAll(svg, false);
    return svg;
  }

  async add(svg, d) {
    await this._ready;
    const id = Date.now().toString(36);
    this._scribbles[id] = d;
    this._save();
    this._render(svg, id, true);
  }

  async delete(svg, scribbleId) {
    await this._ready;
    if (!this._scribbles[scribbleId]) return;
    delete this._scribbles[scribbleId];
    this._save();
    const path = document.getElementById(scribbleId);
    if (path) path.parentNode.removeChild(path);
  }

}
