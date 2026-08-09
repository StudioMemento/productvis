export const THREE_VERSION = '0.185.1';
export const DECODER_BASE_PATH = `/decoders/three-${THREE_VERSION}`;

// Meshes keep the default render layer and also opt into this isolated layer so
// the contact-shadow camera can render only product geometry.
export const CONTACT_SHADOW_LAYER = 7;
