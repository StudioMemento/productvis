import * as THREE from 'three';

export class AnchorOverlay {
  constructor(element, camera, { onSelect } = {}) {
    this.element = element;
    this.camera = camera;
    this.onSelect = onSelect;
    this.nodes = new Map();
    this.vector = new THREE.Vector3();
    this.element?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-anchor-marker]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      this.onSelect?.(button.dataset.anchorMarker);
    });
  }

  update(markers = [], { display = 'off', selectedId = null } = {}) {
    if (!this.element) return;
    const visibleMarkers = display === 'off'
      ? []
      : display === 'selected'
        ? markers.filter((marker) => marker.id === selectedId)
        : markers;
    const activeIds = new Set();

    visibleMarkers.forEach((marker) => {
      if (!Array.isArray(marker.worldPosition) || marker.worldPosition.length < 3) return;
      this.vector.fromArray(marker.worldPosition).project(this.camera);
      const inFront = this.vector.z >= -1 && this.vector.z <= 1;
      const inFrame = Math.abs(this.vector.x) <= 1.1 && Math.abs(this.vector.y) <= 1.1;
      if (!inFront || !inFrame) return;

      activeIds.add(marker.id);
      let node = this.nodes.get(marker.id);
      if (!node) {
        node = document.createElement('button');
        node.type = 'button';
        node.className = 'anchor-marker';
        node.dataset.anchorMarker = marker.id;
        const dot = document.createElement('i');
        const label = document.createElement('span');
        node.append(dot, label);
        this.element.appendChild(node);
        this.nodes.set(marker.id, node);
      }
      node.querySelector('span').textContent = marker.name || 'Anchor';
      node.classList.toggle('is-selected', marker.id === selectedId);
      node.classList.toggle('is-unresolved', marker.resolved === false);
      node.style.left = `${(this.vector.x * 0.5 + 0.5) * 100}%`;
      node.style.top = `${(-this.vector.y * 0.5 + 0.5) * 100}%`;
      node.hidden = false;
    });

    this.nodes.forEach((node, id) => {
      if (!activeIds.has(id)) node.hidden = true;
    });
    this.element.classList.toggle('is-visible', activeIds.size > 0);
    this.element.setAttribute('aria-hidden', String(activeIds.size === 0));
  }

  clear() {
    this.nodes.forEach((node) => node.remove());
    this.nodes.clear();
    this.element?.classList.remove('is-visible');
    this.element?.setAttribute('aria-hidden', 'true');
  }
}
