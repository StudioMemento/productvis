import { sanitizeExperienceState } from './ExperienceGrammar.js';

function absoluteUrl(value, baseUrl = globalThis.location?.href || 'https://localhost/') {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function encode(value) {
  return encodeURIComponent(String(value || ''));
}

export function buildAndroidSceneViewerUrl(experience, {
  baseUrl,
  arOnly = false,
} = {}) {
  const profile = sanitizeExperienceState(experience);
  const file = absoluteUrl(profile.ar.androidGlbUrl, baseUrl);
  if (!file || !/^https:/i.test(file)) return null;
  const fallback = absoluteUrl(profile.ar.fallbackUrl, baseUrl)
    || absoluteUrl(profile.share.publicPlayerUrl, baseUrl)
    || absoluteUrl(baseUrl, baseUrl)
    || 'https://developers.google.com/ar';
  const params = new URLSearchParams({
    file,
    mode: arOnly ? 'ar_only' : 'ar_preferred',
    title: profile.ar.title || profile.title,
    resizable: profile.ar.resizable ? 'true' : 'false',
  });
  if (profile.ar.verticalPlacement) params.set('enable_vertical_placement', 'true');
  const packageName = arOnly ? 'com.google.ar.core' : 'com.google.android.googlequicksearchbox';
  return `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}#Intent;scheme=https;package=${packageName};action=android.intent.action.VIEW;S.browser_fallback_url=${encode(fallback)};end;`;
}

export function buildAndroidWebFallbackUrl(experience, { baseUrl } = {}) {
  const profile = sanitizeExperienceState(experience);
  const file = absoluteUrl(profile.ar.androidGlbUrl, baseUrl);
  if (!file || !/^https:/i.test(file)) return null;
  const url = new URL('https://arvr.google.com/scene-viewer/1.0');
  url.searchParams.set('file', file);
  url.searchParams.set('mode', 'ar_preferred');
  url.searchParams.set('title', profile.ar.title || profile.title);
  url.searchParams.set('resizable', profile.ar.resizable ? 'true' : 'false');
  if (profile.ar.verticalPlacement) url.searchParams.set('enable_vertical_placement', 'true');
  return url.toString();
}

export function buildIosQuickLookUrl(experience, { baseUrl } = {}) {
  const profile = sanitizeExperienceState(experience);
  const url = absoluteUrl(profile.ar.iosUsdzUrl, baseUrl);
  if (!url || !/^https:/i.test(url)) return null;
  return url;
}

export function resolveArHandoff(experience, {
  userAgent = globalThis.navigator?.userAgent || '',
  baseUrl = globalThis.location?.href,
} = {}) {
  const profile = sanitizeExperienceState(experience);
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  const iosUrl = buildIosQuickLookUrl(profile, { baseUrl });
  const androidIntent = buildAndroidSceneViewerUrl(profile, { baseUrl });
  const androidFallback = buildAndroidWebFallbackUrl(profile, { baseUrl });

  if (isIos && iosUrl) return { platform: 'ios', kind: 'quick-look', url: iosUrl, rel: 'ar' };
  if (isAndroid && androidIntent) return { platform: 'android', kind: 'scene-viewer', url: androidIntent, fallbackUrl: androidFallback };
  if (androidFallback) return { platform: 'web', kind: 'scene-viewer-web', url: androidFallback };
  if (iosUrl) return { platform: 'web', kind: 'usdz', url: iosUrl };
  return { platform: 'unsupported', kind: 'none', url: null };
}

export function launchArHandoff(experience, options = {}) {
  const handoff = resolveArHandoff(experience, options);
  if (!handoff.url || typeof document === 'undefined') return handoff;
  const link = document.createElement('a');
  link.href = handoff.url;
  if (handoff.rel) {
    link.rel = handoff.rel;
    const preview = document.createElement('img');
    preview.alt = '';
    preview.width = 1;
    preview.height = 1;
    preview.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    link.appendChild(preview);
  }
  link.style.position = 'fixed';
  link.style.width = '1px';
  link.style.height = '1px';
  link.style.opacity = '0';
  link.style.pointerEvents = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return handoff;
}
