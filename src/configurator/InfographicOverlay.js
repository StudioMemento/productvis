import * as THREE from 'three';
import { layoutInfographicCards, createInfographicConnector } from './InfographicLayout.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class InfographicOverlay {
  constructor(element, camera, { onSelect } = {}) {
    this.element = element;
    this.camera = camera;
    this.onSelect = onSelect;
    this.vector = new THREE.Vector3();
    this.cards = new Map();
    this.lines = new Map();

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('infographic-line-layer');
    this.svg.setAttribute('aria-hidden', 'true');
    this.cardLayer = document.createElement('div');
    this.cardLayer.className = 'infographic-card-layer';
    this.element?.append(this.svg, this.cardLayer);

    this.element?.addEventListener('click', (event) => {
      const card = event.target.closest('[data-infographic-card]');
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      this.onSelect?.(card.dataset.infographicCard);
    });
  }

  #getCard(record) {
    let node = this.cards.get(record.id);
    if (!node) {
      node = document.createElement('button');
      node.type = 'button';
      node.className = 'infographic-card';
      node.dataset.infographicCard = record.id;
      const eyebrow = document.createElement('small');
      const title = document.createElement('strong');
      const body = document.createElement('span');
      node.append(eyebrow, title, body);
      this.cardLayer.appendChild(node);
      this.cards.set(record.id, node);
    }
    node.querySelector('small').textContent = record.eyebrow || 'FEATURE';
    node.querySelector('strong').textContent = record.title || 'Infographic';
    node.querySelector('span').textContent = record.body || '';
    node.style.setProperty('--infographic-accent', record.accent || '#ff7950');
    return node;
  }

  #getLine(record) {
    let item = this.lines.get(record.id);
    if (!item) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('infographic-line-group');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('infographic-connector');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.classList.add('infographic-anchor-dot');
      dot.setAttribute('r', '4');
      group.append(path, dot);
      this.svg.appendChild(group);
      item = { group, path, dot };
      this.lines.set(record.id, item);
    }
    const accent = record.accent || '#ff7950';
    item.path.style.stroke = accent;
    item.dot.style.fill = accent;
    return item;
  }

  update(markers = [], records = [], { display = 'off', selectedId = null } = {}) {
    if (!this.element || !this.camera) return;
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    if (width < 2 || height < 2 || display === 'off') {
      this.#hideAll();
      return;
    }

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const markerMap = new Map((Array.isArray(markers) ? markers : []).map((marker) => [marker.id, marker]));
    const candidates = (Array.isArray(records) ? records : [])
      .filter((record) => record.visible !== false)
      .filter((record) => display === 'all' || record.id === selectedId);
    const activeIds = new Set();
    const layoutInput = [];

    candidates.forEach((record) => {
      const marker = markerMap.get(record.anchorId);
      if (!marker || marker.resolved === false || !Array.isArray(marker.worldPosition)) return;
      this.vector.fromArray(marker.worldPosition).project(this.camera);
      if (this.vector.z < -1 || this.vector.z > 1 || Math.abs(this.vector.x) > 1.18 || Math.abs(this.vector.y) > 1.18) return;

      const anchorX = (this.vector.x * 0.5 + 0.5) * width;
      const anchorY = (-this.vector.y * 0.5 + 0.5) * height;
      const side = record.side === 'left' || record.side === 'right'
        ? record.side
        : anchorX < width * 0.5 ? 'right' : 'left';
      const card = this.#getCard(record);
      const line = this.#getLine(record);
      const cardWidth = clamp(width * 0.25, 190, 286);
      card.style.width = `${cardWidth}px`;
      card.hidden = false;
      card.style.visibility = 'hidden';
      const cardHeight = Math.max(86, card.offsetHeight || 106);
      layoutInput.push({
        record, marker, card, line, side, anchorX, anchorY,
        cardWidth, cardHeight, idealY: anchorY - cardHeight * 0.5,
      });
      activeIds.add(record.id);
    });

    const layout = layoutInfographicCards(layoutInput, { width, height });
    layout.forEach((item) => {
      item.card.style.left = `${item.cardX}px`;
      item.card.style.top = `${item.cardY}px`;
      item.card.style.visibility = 'visible';
      item.card.classList.toggle('is-selected', item.record.id === selectedId);
      item.card.setAttribute('aria-pressed', String(item.record.id === selectedId));
      item.line.path.setAttribute('d', createInfographicConnector(item));
      item.line.dot.setAttribute('cx', item.anchorX.toFixed(2));
      item.line.dot.setAttribute('cy', item.anchorY.toFixed(2));
      item.line.group.hidden = false;
      item.line.group.classList.toggle('is-selected', item.record.id === selectedId);
    });

    this.cards.forEach((card, id) => { if (!activeIds.has(id)) card.hidden = true; });
    this.lines.forEach((line, id) => { if (!activeIds.has(id)) line.group.hidden = true; });
    const visible = activeIds.size > 0;
    this.element.classList.toggle('is-visible', visible);
    this.element.setAttribute('aria-hidden', String(!visible));
  }

  #hideAll() {
    this.cards.forEach((card) => { card.hidden = true; });
    this.lines.forEach((line) => { line.group.hidden = true; });
    this.element?.classList.remove('is-visible');
    this.element?.setAttribute('aria-hidden', 'true');
  }

  clear() {
    this.cards.forEach((node) => node.remove());
    this.lines.forEach((item) => item.group.remove());
    this.cards.clear();
    this.lines.clear();
    this.#hideAll();
  }
}
