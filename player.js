const STAFF_GAP = 15;
const MARGIN = 30;
const HEADER_HEIGHT = 100;
const LOCAL_OPTIONS_KEY = 'options';
const DEFAULT_LOCAL_OPTIONS = {scale: 1};

let localOptions;

initOptions();

function initOptions() {
  return chrome.storage.local.get(LOCAL_OPTIONS_KEY, result => {
    localOptions = result[LOCAL_OPTIONS_KEY] || DEFAULT_LOCAL_OPTIONS;
  });
}

function saveOptions() {
  chrome.storage.local.set({[LOCAL_OPTIONS_KEY]: localOptions});
}


class Score {
  constructor(images, title, artist) {
    this._title = title;
    this._artist = artist;
    this.openButton = this._createOpenButton();
    this._prepareStrip(images);
    this._paint = this._paint.bind(this);
    this._currentPage = 0;
    this._pages = undefined;
  }

  _createOpenButton() {
    const button = document.createElement('button');
    button.textContent = 'Show full score';
    button.className = 'control-button abs flowscore-score-button bottomAboveSheet';
    button.setAttribute('disabled', '');
    button.addEventListener('click', this.showScore.bind(this));
    return button;
  }

  _prepareStrip(images) {
    const imageUrls = [];
    for (const image of images) imageUrls.push(image.src);
    this._staffHeight = images[0].height;
    chrome.runtime.sendMessage({action: 'buildStrip', imageUrls}, response => {
      this._strip = response;
      this._imageRatio = this._staffHeight / response.height;
      this._stripImage = document.createElement('img');
      this._stripImage.src = this._strip.data;
      this.openButton.removeAttribute('disabled');
    });
  }

  showScore() {
    const scoreElement = document.createElement('div');
    scoreElement.setAttribute('id', 'flowscore-score');
    scoreElement.addEventListener('click', ev => {
      let nextPage;
      if (ev.clientX < window.innerWidth / 2) {
        if (this._currentPage > 0) nextPage = this._currentPage - 1;
      } else {
        if (this._currentPage < this._pages.length - 1) nextPage = this._currentPage + 1;
      }
      if (nextPage !== undefined) this._turnPage(nextPage);
    })
    scoreElement.innerHTML = `
      <div id="flowscore-pages"></div>
      <div id="flowscore-scale">
        Scale: <span id="flowscore-scale-gauge"></span>
        <span id="flowscore-scale-down" class="flowscore-scale-button"></span>
        <span id="flowscore-scale-up" class="flowscore-scale-button"></span>
      </div>
      <div id="flowscore-close"></div>
    `;
    document.getElementsByTagName('body')[0].appendChild(scoreElement);
    document.getElementById('flowscore-scale-down').addEventListener('click', ev => {
      ev.stopPropagation();
      this._scale(-1);
    });
    document.getElementById('flowscore-scale-up').addEventListener('click', ev => {
      ev.stopPropagation();
      this._scale(+1);
    });
    document.getElementById('flowscore-close').addEventListener('click', ev => {
      ev.stopPropagation();
      document.webkitExitFullscreen();
      window.removeEventListener('resize', this._paint);
      scoreElement.parentNode.removeChild(scoreElement);
      this._pages = undefined;
    });
    scoreElement.webkitRequestFullscreen({navigationUI: 'hide'});
    window.addEventListener('resize', this._paint);
  }

  _turnPage(nextPage) {
    const scoreElement = document.getElementById('flowscore-score');
    const pagesElement = document.getElementById('flowscore-pages');
    if (nextPage !== undefined) {
      if (this._pages[this._currentPage]) {
        scoreElement.removeChild(this._pages[this._currentPage].element);
      }
      this._currentPage = nextPage;
    }
    scoreElement.appendChild(this._pages[this._currentPage].element);
    pagesElement.textContent = `Page ${this._currentPage + 1} of ${this._pages.length}`;
  }

  _scale(delta) {
    localOptions.scale += delta / 100;
    saveOptions();
    this._paint();
  }

  _paint() {
    const scoreElement = document.getElementById('flowscore-score');
    if (this._pages) scoreElement.removeChild(this._pages[this._currentPage].element);
    this._pages = [];
    let barIndex = 0;
    while (barIndex < this._strip.bars.length - 1) {
      const page = this._paintPage(barIndex, barIndex ? 0 : HEADER_HEIGHT);
      if (barIndex === 0) {
        page.element = this._buildHeader(page.element);
      }
      barIndex = page.barIndex;
      page.element.className = 'content';
      this._pages.push(page);
    }
    document.getElementById('flowscore-scale-gauge').textContent =
      Math.round(localOptions.scale * 100) + '%';
    this._turnPage();
  }

  _buildHeader(canvas) {
    const contentElement = document.createElement('div');
    const artistElement = document.createElement('div');
    artistElement.className = 'flowscore-artist';
    artistElement.textContent = this._artist;
    const titleElement = document.createElement('div');
    titleElement.className = 'flowscore-title';
    titleElement.textContent = this._title;
    contentElement.appendChild(artistElement);
    contentElement.appendChild(titleElement);
    contentElement.appendChild(canvas);
    return contentElement;
  }

  _paintPage(barIndex, heightReduction = 0) {
    const bars = this._strip.bars;
    const scale = localOptions.scale;
    const width = window.innerWidth - 2 * MARGIN;
    const height = window.innerHeight - 2 * MARGIN - heightReduction;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    const numStaffs = Math.floor(height / ((this._staffHeight + STAFF_GAP) * scale)) || 1;
    let top = 0;
    for (let i = 0; i < numStaffs; i++) {
      if (barIndex >= bars.length - 1) break;
      const firstBarIndex = barIndex;
      const left = firstBarIndex ? bars[firstBarIndex].leftEdge : this._strip.leftEdge;
      barIndex++;
      while (
        barIndex + 1 < bars.length &&
        (bars[barIndex + 1].rightEdge - left) * this._imageRatio * scale < width
      ) {
        barIndex++;
      }
      const staffWidth = bars[barIndex].rightEdge - left;
      ctx.drawImage(
        this._stripImage,
        left, 0, staffWidth, this._strip.height,
        0, top, staffWidth * this._imageRatio * scale, this._staffHeight * scale
      );
      top += (this._staffHeight + STAFF_GAP) * scale;
    }
    return {element: canvas, barIndex};
  }
}

let lastDecoratedPath;

function initScore() {
  if (window.location.pathname.startsWith('/player/')) {
    const sheetElement = document.getElementById('sheet');
    const titleElement = document.getElementById('flat-song-info');
    const artistElement = document.getElementById('flat-song-artist');
    if (!sheetElement || !titleElement || !artistElement) return;
    const score = new Score(
      sheetElement.getElementsByTagName('img'), titleElement.textContent, artistElement.textContent
    );
    document.getElementById('player-layout').appendChild(score.openButton);
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

document.addEventListener('visibilitychange', function(){
  if (document.visibilityState === 'visible' && window.location.pathname.startsWith('/player/')) {
    chrome.runtime.sendMessage({action: 'keepAwake', level: 'display'});
  } else {
    chrome.runtime.sendMessage({action: 'keepAwake'});
  }
});
