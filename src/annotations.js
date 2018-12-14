'use strict';
/* global SVG_NAMESPACE */
/* exported RollAnnotations SHEET_HEIGHT */

const PRESSURE_THRESHOLD = 0.3;
const SHEET_HEIGHT = 299;


class RollAnnotations {
  constructor(sheetElement, scribbles) {
    this._hasPen = false;
    this._drawingPointerId = null;
    this._drawingPath = null;
    this._lastX = null;
    this._lastY = null;
    this._firstPoint = null;
    this._erasing = false;
    this._eraserButtonDown = false;

    const sheetRect = sheetElement.getBoundingClientRect();
    this._sheet = sheetElement;
    this._sketch = document.createElementNS(SVG_NAMESPACE, 'svg');
    this._sketch.id = 'flowscore-sketch';
    this._sketch.setAttribute('class', 'flowscore-annotations');
    this._sketch.setAttribute('viewBox', `0 0 ${sheetRect.width} ${SHEET_HEIGHT}`);
    this._sketchPath = document.createElementNS(SVG_NAMESPACE, 'path');
    this._sketch.appendChild(this._sketchPath);
    sheetElement.appendChild(this._sketch);

    this._scribbles = scribbles;
    scribbles.renderAll(this._sketch, true);

    sheetElement.addEventListener('mousedown', this._stopEvent.bind(this), true);
    sheetElement.addEventListener('mousemove', this._stopEvent.bind(this), true);
    sheetElement.addEventListener('touchstart', this._stopEvent.bind(this), true);
    sheetElement.addEventListener('touchmove', this._stopEvent.bind(this), true);
    sheetElement.addEventListener('pointerdown', this._handlePenDown.bind(this), true);
    sheetElement.addEventListener('pointerup', this._handlePenUp.bind(this), true);
    sheetElement.addEventListener('pointermove', this._handlePenMove.bind(this), true);

    this.eraserButton = this._createEraserButton();
  }

  _stopEvent(ev) {
    if (this._drawingPointerId) ev.stopImmediatePropagation();
  }

  _handlePenDown(ev) {
    if (ev.pointerType !== 'pen') return;
    if (!this._hasPen) {
      this._hasPen = true;
      this.eraserButton.style = '';
    }
    this._drawingPointerId = ev.pointerId;
    if (this._eraserButtonDown) {
      this._erasing = true;
      return this._erase(ev);
    }
    const sheetRect = this._sheet.getBoundingClientRect();
    const x = formatSvgNumber(ev.clientX - sheetRect.left);
    const y = formatSvgNumber(ev.clientY - sheetRect.top);
    this._drawingPath = `M${x} ${y}`;
    this._firstPoint = true;
    this._lastX = ev.screenX;
    this._lastY = ev.screenY;
    this._updateSketch(ev);
  }

  _handlePenUp(ev) {
    if (ev.pointerId !== this._drawingPointerId) return;
    this._drawingPointerId = null;
    if (this._erasing) {
      this._erasing = false;
      this._updateEraserButton();
      return;
    }
    this._scribbles.add(this._sketch, this._drawingPath);
    this._drawingPath = null;
    this._sketchPath.removeAttribute('d');
  }

  _handlePenMove(ev) {
    if (ev.pointerType === 'pen' && !this._drawingPointerId && ev.pressure > PRESSURE_THRESHOLD) {
      return this._handlePenDown(ev);
    }
    if (ev.pointerId !== this._drawingPointerId) return;
    if (ev.pressure <= PRESSURE_THRESHOLD) return this._handlePenUp(ev);
    if (this._erasing) return this._erase(ev);
    const dx = formatSvgNumber(ev.screenX - this._lastX);
    const dy = formatSvgNumber(ev.screenY - this._lastY);
    if (dx === '0' && dy === '0') return;
    this._drawingPath += `${this._firstPoint ? 'l' : ' '}${dx} ${dy}`;
    this._firstPoint = false;
    this._lastX += Number.parseFloat(dx);
    this._lastY += Number.parseFloat(dy);
    this._updateSketch(ev);
  }

  _updateSketch(ev) {
    this._sketchPath.setAttribute('d', this._drawingPath);
  }

  _erase(ev) {
    const sheetRect = this._sheet.getBoundingClientRect();
    const mousePoint = {x: ev.clientX - sheetRect.left, y: ev.clientY - sheetRect.top};
    const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
    for (const element of elements) {
      if (element.nodeName === 'path' && element.getAttribute('class') === 'flowscore-scribble' &&
          element.id) {
        const pathLength = element.getTotalLength();
        for (let i = 0; i < pathLength; i += 5) {
          if (distance2(mousePoint, element.getPointAtLength(i)) < 25) {
            this._scribbles.delete(this._sketch, element.id);
            break;
          }
        }
      }
    }
  }

  _createEraserButton() {
    const button = document.createElement('button');
    button.className =
      'control-button abs flowscore-control-button flowscore-erase-button bottomAboveSheet';
    button.style = 'display: none';
    button.textContent = 'erase';
    button.addEventListener('pointerdown', ev => {
      if (ev.pointerType !== 'touch') return;
      ev.preventDefault();
      this._eraserButtonDown = true;
      this._updateEraserButton();
    });
    button.addEventListener('pointerup', ev => {
      if (ev.pointerType !== 'touch') return;
      ev.preventDefault();
      this._eraserButtonDown = false;
      this._updateEraserButton();
    });
    button.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }, true);
    return button;
  }

  _updateEraserButton() {
    if (this._eraserButtonDown || this._erasing) {
      this.eraserButton.classList.add('active');
    } else {
      this.eraserButton.classList.remove('active');
    }
  }

}


function distance2(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function formatSvgNumber(n) {
  return n.toFixed(1).replace(/\.0+$/, '').replace(/^0\./, '.');
}
