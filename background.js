chrome.power.requestKeepAwake('display');

chrome.runtime.onMessage.addListener(function(message, sender, reply) {
  switch (message.action) {
    case 'buildStrip': {
      buildStrip(message.imageUrls, reply);
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

function buildStrip(imageUrls, reply) {
  Promise.all(imageUrls.map(url => fetch(url).then(response => {
    if (!response.ok) throw new Error('HTTP error, status ' + reponse.status);
    return response.blob().then(blob => createImageBitmap(blob));
  }))).then(images => {
    const height = images[0].height;
    let width = 0;
    for (const image of images) width += image.width;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    const ctx = canvas.getContext('2d');
    let x = 0;
    for (const image of images) {
      ctx.drawImage(image, x, 0);
      x += image.width;
      image.close();
    }
    const data = ctx.getImageData(0, 0, width, height).data;
    let leftEdge = 0, rightEdge = width - 1;
    while (leftEdge < width && isColumnEmpty(leftEdge)) leftEdge++;
    while (rightEdge > 0 && isColumnEmpty(rightEdge)) rightEdge--;
    const bars = detectBars();
    console.log({width, height, leftEdge, rightEdge, bars});
    reply({data: canvas.toDataURL(), width, height, leftEdge, rightEdge, bars});


    function isColumnEmpty(x) {
      for (let y = 0; y < height; y++) {
        if (pixelAt(x, y)) return false;
      }
      return true;
    }

    function pixelAt(x, y) {
      return data[(y * width + x) * 4 + 3];
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
          if (streak > height / 2) return true;
        } else {
          streak = 0;
          if (y > height / 2) return false;
        }
      }
      return false;
    }
  });
}

