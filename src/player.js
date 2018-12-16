'use strict';
/* global Scribbles Score RollAnnotations */

let lastDecoratedPath;

function initScore() {
  if (window.location.pathname.startsWith('/player/') &&
      !/&courseId=/.test(window.location.search)) {
    const sheetElement = document.getElementById('sheet');
    const titleElement = document.getElementById('flat-song-info');
    const artistElement = document.getElementById('flat-song-artist');
    if (!sheetElement || !titleElement || !artistElement) return;
    const scribbles = new Scribbles(window.location.pathname.replace(/\/player\//, ''));
    scribbles.ready.catch(e => {
      alert('Failed to load annotations: ' + e);
    });
    const score = new Score(
      sheetElement.getElementsByTagName('img'), titleElement.textContent, artistElement.textContent,
      scribbles
    );
    const annotations = new RollAnnotations(sheetElement, scribbles);
    document.getElementById('player-layout').appendChild(score.openButton);
    document.getElementById('player-layout').appendChild(annotations.eraserButton);
    chrome.runtime.sendMessage({action: 'keepAwake', level: 'display'});
  } else {
    chrome.runtime.sendMessage({action: 'keepAwake'});
  }
  lastDecoratedPath = window.location.pathname;
}

function decoratePage() {
  if (window.location.pathname !== lastDecoratedPath) initScore();
  setTimeout(decoratePage, 200);
}

decoratePage();

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && window.location.pathname.startsWith('/player/')) {
    chrome.runtime.sendMessage({action: 'keepAwake', level: 'display'});
  } else {
    chrome.runtime.sendMessage({action: 'keepAwake'});
  }
});
