/** A bare host like "google.com" isn't a valid href for the opener plugin
 * (see ExternalLink.tsx) - assumes https:// unless a scheme's already
 * there. Shared by every widget that lets a user paste in a URL by hand
 * (Shortcuts, Of the Day's puzzle links). */
export function normalizeUrl(url: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}
