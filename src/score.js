'use strict';
/* global localOptions saveOptions SHEET_HEIGHT */
/* exported Score */

const STAFF_GAP = 15;
const MARGIN = 30;
const HEADER_HEIGHT = 100;

class Score {
  constructor(images, title, artist, scribbles) {
    this._images = images;
    this._title = title;
    this._artist = artist;
    this._scribbles = scribbles;
    this.openButton = this._createOpenButton();
    this._analyze(images);
    this._paint = this._paint.bind(this);
    this._currentPage = 0;
    this._pages = undefined;
  }

  _createOpenButton() {
    const button = document.createElement('button');
    button.textContent = 'Show full score';
    button.className =
      'control-button abs flowscore-control-button flowscore-score-button bottomAboveSheet';
    button.setAttribute('disabled', '');
    button.addEventListener('click', this.showScore.bind(this));
    return button;
  }

  _analyze(images) {
    const imageRect = images[0].getBoundingClientRect();
    this._imageWidth = images[0].naturalWidth;
    this._imageHeight = images[0].naturalHeight;
    this._imageRatio = imageRect.height / this._imageHeight;
    this._staffHeight = imageRect.height;
    this._staffOffset = imageRect.top - images[0].parentNode.getBoundingClientRect().top;
    const imageUrls = [];
    for (const image of images) imageUrls.push(image.src);
    chrome.runtime.sendMessage({action: 'analyze', imageUrls}, response => {
      this._analysis = response;
      this.openButton.removeAttribute('disabled');
    });
  }

  async showScore() {
    this._annotations = await this._scribbles.renderPassive();
    const scoreElement = document.createElement('div');
    scoreElement.setAttribute('id', 'flowscore-score');
    scoreElement.addEventListener('click', ev => {
      let nextPage;
      if (ev.clientX < window.innerWidth / 2) {
        if (this._currentPage > 0) nextPage = this._currentPage - 1;
      } else if (this._currentPage < this._pages.length - 1) {
        nextPage = this._currentPage + 1;
      }
      if (nextPage !== undefined) this._turnPage(nextPage);
    });
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
      this._annotations = undefined;
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
    while (barIndex < this._analysis.bars.length) {
      const page = this._paintPage(barIndex, barIndex ? 0 : HEADER_HEIGHT);
      if (barIndex === 0) {
        page.element = this._buildHeader(page.element);
      }
      barIndex = page.barIndex;
      page.element.classList.add('content');
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
    const bars = this._analysis.bars;
    const scale = localOptions.scale;
    const width = window.innerWidth - 2 * MARGIN;
    const height = window.innerHeight - 2 * MARGIN - heightReduction;
    const element = document.createElement('div');
    element.className = 'flowscore-relative';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.setAttribute('width', width / this._imageRatio);
    canvas.setAttribute('height', height / this._imageRatio);
    canvas.setAttribute('style', `width: ${width}px; height: ${height}px;`);
    element.appendChild(canvas);
    const numStaffs = Math.floor(height / ((this._staffHeight + STAFF_GAP) * scale)) || 1;
    let top = 0;
    for (let i = 0; i < numStaffs && barIndex < bars.length; i++) {
      const firstBarIndex = barIndex;
      const left = firstBarIndex ? bars[firstBarIndex].leftEdge : this._analysis.leftEdge;
      while (
        barIndex + 1 < bars.length &&
        (bars[barIndex + 1].rightEdge - left) * this._imageRatio * scale < width
      ) {
        barIndex++;
      }
      const right = bars[barIndex].rightEdge;
      const stripWidth = right - left;
      this._blitImages(ctx, top, left, right);
      const svg = this._annotations.cloneNode(true);
      svg.setAttribute(
        'viewBox', `${left * this._imageRatio} 0 ${stripWidth * this._imageRatio} ${SHEET_HEIGHT}`);
      svg.setAttribute('style', `top: ${top * this._imageRatio - this._staffOffset}px; left: 0`);
      svg.setAttribute('width', stripWidth * this._imageRatio * scale);
      svg.setAttribute('height', SHEET_HEIGHT * scale);
      element.appendChild(svg);
      top += (this._staffHeight + STAFF_GAP) / this._imageRatio * scale;
    }
    return {element, barIndex};
  }

  _blitImages(ctx, top, left, right) {
    const scale = localOptions.scale;
    const canvas = {x: 0, y: top, w: undefined, h: this._imageHeight * scale};
    const startImageIndex = Math.floor(left / this._imageWidth);
    const endImageIndex = Math.floor(right / this._imageWidth);
    for (let imageIndex = startImageIndex; imageIndex <= endImageIndex; imageIndex++) {
      const image = {x: 0, y: 0, w: this._imageWidth, h: this._imageHeight};
      if (imageIndex * this._imageWidth < left) {
        image.x = left % this._imageWidth;
        image.w = this._imageWidth - (left % this._imageWidth);
      }
      if (imageIndex * this._imageWidth + image.x + image.w > right) {
        image.w = right - imageIndex * this._imageWidth - image.x;
      }
      canvas.w = image.w * scale;
      ctx.drawImage(
        this._images[imageIndex],
        image.x, image.y, image.w, image.h,
        canvas.x, canvas.y, canvas.w, canvas.h
      );
      canvas.x += canvas.w;
    }
  }
}
