/**
 * Resolves the public/shared origin for shareable links.
 * In AI Studio preview (`ais-dev-*`), links copied directly from `window.location.origin`
 * point to the private developer preview (which blocks external users and iPhone/WhatsApp
 * browsers via Google auth/cookie checks). Rewriting `ais-dev-` -> `ais-pre-` produces the
 * public Shared App URL automatically while preserving custom domains or localhost.
 */
export function getPublicAppOrigin(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  if (origin.includes('://ais-dev-')) {
    return origin.replace('://ais-dev-', '://ais-pre-');
  }
  return origin;
}

export function isRunningOnDevPreviewOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.origin.includes('://ais-dev-');
}

export function buildPublicUrl(pathAndQuery: string): string {
  const origin = getPublicAppOrigin();
  const normalized = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return origin ? `${origin}${normalized}` : normalized;
}

/**
 * Copies text reliably on desktop browsers, iOS Safari, and embedded iframes.
 */
export async function copyTextSafely(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below (needed in some iOS Safari / iframe contexts)
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    }
  } catch {
    return false;
  }

  return false;
}
