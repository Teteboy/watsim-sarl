/**
 * Resolve a stored image URL to a full accessible URL in production.
 * - Full URLs pass through unchanged
 * - Relative /uploads/ paths get the backend base URL prepended
 * - Null/undefined returns null
 */
export function resolveUploadUrl(storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;
  const backendUrl = (import.meta.env?.VITE_BACKEND_URL as string) ?? '';
  const cleanBackend = backendUrl.replace(/\/$/, '');
  if (storedUrl.startsWith('http')) {
    try {
      const parsed = new URL(storedUrl);
      if (cleanBackend && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.pathname.startsWith('/uploads/')) {
        return `${cleanBackend}${parsed.pathname}`;
      }
    } catch {
      return storedUrl;
    }
    return storedUrl;
  }
  if (storedUrl.startsWith('/uploads/')) {
    return cleanBackend ? `${cleanBackend}${storedUrl}` : storedUrl;
  }
  return storedUrl;
}
