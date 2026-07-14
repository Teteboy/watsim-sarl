/**
 * Resolve a stored image URL to a full accessible URL in production.
 * - Full URLs pass through unchanged
 * - Relative /uploads/ paths get the backend base URL prepended
 * - Null/undefined returns null
 */
export function resolveUploadUrl(storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;
  if (storedUrl.startsWith('http')) return storedUrl;
  const backendUrl = (import.meta.env?.VITE_BACKEND_URL as string) ?? '';
  const cleanBackend = backendUrl.replace(/\/$/, '');
  if (storedUrl.startsWith('/uploads/')) {
    return cleanBackend ? `${cleanBackend}${storedUrl}` : storedUrl;
  }
  return storedUrl;
}
