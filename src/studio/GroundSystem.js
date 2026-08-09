import { ContactShadowRenderer } from './ContactShadowRenderer.js';

/**
 * Ground is a world-space contract (Y=0), not visible geometry. The only visible
 * component is the cached contact shadow texture.
 */
export class GroundSystem {
  constructor(renderer, scene) {
    this.contactShadow = new ContactShadowRenderer(renderer, scene);
    this.enabled = true;
    this.shadowsEnabled = true;
    this.groundOffset = 0;
    this.lastBounds = null;
    this.lastRadius = 1;
  }

  initialize() {
    this.contactShadow.initialize();
    return this;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.contactShadow.group.visible = this.enabled;
    this.contactShadow.setEnabled(this.enabled && this.shadowsEnabled);
  }

  setShadowsEnabled(enabled) {
    this.shadowsEnabled = Boolean(enabled);
    this.contactShadow.setEnabled(this.enabled && this.shadowsEnabled);
  }

  setOpacity(value) {
    this.contactShadow.setOpacity(value);
  }

  setSoftness(value) {
    this.contactShadow.setSoftness(value);
  }

  setGroundOffset(value) {
    this.groundOffset = Number(value) || 0;
    const changed = this.contactShadow.setGroundOffset(this.groundOffset);
    if (changed && this.lastBounds) this.contactShadow.updateForBounds(this.lastBounds, this.lastRadius);
  }

  setQuality(profile) {
    this.contactShadow.setQuality(profile);
  }

  updateForBounds(bounds, radius) {
    this.lastBounds = bounds?.clone?.() || null;
    this.lastRadius = radius;
    this.contactShadow.updateForBounds(bounds, radius);
  }

  markDirty() {
    this.contactShadow.markDirty();
  }

  update(options) {
    return this.contactShadow.render(options);
  }

  dispose() {
    this.contactShadow.dispose();
  }
}
