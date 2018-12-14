'use strict';

chrome.runtime.onMessage.addListener(function(message, sender, reply) {
  switch (message.action) {
    case 'analyze': {
      analyze(message.imageUrls, reply);
      return true;
    }
    case 'keepAwake': {
      if (message.level) {
        chrome.power.requestKeepAwake(message.level);
      } else {
        chrome.power.releaseKeepAwake();
      }
      break;
    }
    default:
      console.log('Unknown message:', message);
  }
});

function analyze(imageUrls, reply) {

  Promise.all(imageUrls.map(url => fetch(url).then(response => {
    if (!response.ok) throw new Error('HTTP error, status ' + response.status);
    return response.blob().then(blob => createImageBitmap(blob));
  }))).then(images => {
    const height = images[0].height;
    const imageWidth = images[0].width;
    const minBarHeight = height >= 300 ? 200 : 100;
    let width = 0;
    const bitmaps = images.map(image => {
      width += image.width;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('width', image.width);
      canvas.setAttribute('height', image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, image.width, image.height).data;
      image.close();
      return data;
    });
    let leftEdge = 0, rightEdge = width - 1;
    while (leftEdge < width && isColumnEmpty(leftEdge)) leftEdge++;
    while (rightEdge > 0 && isColumnEmpty(rightEdge)) rightEdge--;
    const detectedBars = detectBars();
    console.log({width, height, leftEdge, rightEdge, minBarHeight, detectedBars});
    reply({width, height, leftEdge, rightEdge, bars: detectedBars});


    function isColumnEmpty(x) {
      for (let y = 0; y < height; y++) {
        if (pixelAt(x, y)) return false;
      }
      return true;
    }

    function pixelAt(x, y) {
      return bitmaps[Math.floor(x / imageWidth)][(y * imageWidth + (x % imageWidth)) * 4 + 3];
    }

    function detectBars() {
      const bars = [];
      let currentBar;
      for (let x = leftEdge; x < rightEdge; x++) {
        if (isBar(x)) {
          if (currentBar) {
            currentBar.rightEdge = x;
          } else {
            currentBar = {leftEdge: x, rightEdge: x};
          }
        } else if (currentBar && x > currentBar.rightEdge + 20) {
          bars.push(currentBar);
          currentBar = undefined;
        }
      }
      if (currentBar) bars.push(currentBar);
      return bars;
    }

    function isBar(x) {
      let streak = 0;
      for (let y = 0; y < height; y++) {
        if (pixelAt(x, y)) {
          streak++;
          if (streak > minBarHeight) return true;
        } else {
          streak = 0;
          if (y > height - minBarHeight) return false;
        }
      }
      return false;
    }
  });
}

