// ─── packages/perception/src/screenshot.ts ───
// Screenshot capture utilities.
// In Manifest V3, screenshots are captured via chrome.tabs.captureVisibleTab
// from the background service worker, NOT from the content script.
// This module provides helpers for processing the captured image.

export interface CaptureResult {
  dataUrl: string;    // data:image/webp;base64,...
  base64: string;     // raw base64 without prefix
  width: number;
  height: number;
  mediaType: 'image/webp' | 'image/png';
  quality: number;
  sha256: string;
  capture_ms: number;
}

/**
 * Computes SHA-256 hash of a base64-encoded image.
 * Uses SubtleCrypto (available in service workers and content scripts).
 */
export async function computeSHA256(base64: string): Promise<string> {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Strips the data URL prefix and returns raw base64.
 */
export function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

/**
 * Determines image dimensions from a data URL by loading it into an
 * OffscreenCanvas (available in service workers) or Image element.
 *
 * In a service worker, we use the Blob + createImageBitmap approach.
 */
export async function getImageDimensions(
  base64: string,
  mediaType: string
): Promise<{ width: number; height: number }> {
  // Convert base64 to blob
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mediaType });

  // createImageBitmap is available in service workers
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height };
}

/**
 * Captures the visible tab as a WebP screenshot.
 * Must be called from the background service worker.
 *
 * Chrome: chrome.tabs.captureVisibleTab
 * Firefox: browser.tabs.captureVisibleTab (returns PNG, converted to WebP if possible)
 */
export async function captureScreenshot(
  quality: number = 65
): Promise<CaptureResult> {
  const start = performance.now();

  // Use the chrome/browser API
  const api = (globalThis as any).chrome || (globalThis as any).browser;
  if (!api?.tabs?.captureVisibleTab) {
    throw new Error('captureVisibleTab API not available — must run in background service worker');
  }

  // Chrome supports WebP natively; Firefox returns PNG
  const isChrome = !!(globalThis as any).chrome?.runtime?.getManifest;
  const format = isChrome ? 'webp' : 'png';

  const dataUrl: string = await api.tabs.captureVisibleTab(undefined, {
    format,
    quality,
  });

  const base64 = stripDataUrlPrefix(dataUrl);
  const sha256 = await computeSHA256(base64);
  const { width, height } = await getImageDimensions(base64, `image/${format}`);

  const capture_ms = performance.now() - start;

  return {
    dataUrl,
    base64,
    width,
    height,
    mediaType: `image/${format}` as CaptureResult['mediaType'],
    quality,
    sha256,
    capture_ms,
  };
}
