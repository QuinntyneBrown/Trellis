import { Injectable } from '@angular/core';

/**
 * Thin wrapper over the async Clipboard API. An injectable service (rather
 * than free functions) so consumers' specs can mock the clipboard away --
 * jsdom implements neither navigator.clipboard nor ClipboardItem.
 *
 * Both methods reject with a friendly Error when the API is unavailable
 * (non-secure context, or a browser without ClipboardItem), so callers can
 * surface the message through the existing error toast unchanged.
 */
@Injectable({
  providedIn: 'root',
})
export class ClipboardService {
  copyText(text: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      return Promise.reject(new Error('The clipboard is not available in this browser.'));
    }
    return navigator.clipboard.writeText(text);
  }

  /**
   * Takes the PNG as a *pending promise* (not an awaited Blob): the
   * ClipboardItem must be constructed synchronously within the user's click
   * gesture or Safari rejects the write, so the still-rendering blob promise
   * is handed straight to the ClipboardItem.
   */
  copyPng(png: Promise<Blob>): Promise<void> {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      return Promise.reject(new Error('Copying images is not supported in this browser.'));
    }
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  }
}
