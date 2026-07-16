import { promises as fs } from 'fs';
import { resolve, extname } from 'path';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

const UPLOAD_DIR = resolve(process.cwd(), 'uploads');

async function ensureUploadDir(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

export async function uploadKycDocument(userId: string, originalName: string, buffer: Buffer, contentType: string): Promise<string> {
  await ensureUploadDir();
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
  const filename = `kyc_${userId}_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
  const filepath = resolve(UPLOAD_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return filename;
}

export async function uploadProfilePicture(userId: string, buffer: Buffer, contentType: string): Promise<string> {
  await ensureUploadDir();
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const filename = `profile_${userId}_${Date.now()}.${ext}`;
  const filepath = resolve(UPLOAD_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return filename;
}

export async function uploadProductImage(productId: string, buffer: Buffer, contentType: string): Promise<string> {
  await ensureUploadDir();
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filename = `product_${productId}_${Date.now()}.${ext}`;
  const filepath = resolve(UPLOAD_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return filename;
}

export async function uploadPublicityImage(buffer: Buffer, contentType: string): Promise<string> {
  await ensureUploadDir();
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filename = `publicity_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
  const filepath = resolve(UPLOAD_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return filename;
}

export function getBackendBaseUrl(): string {
  return env.BACKEND_URL || `http://localhost:${env.PORT || 3001}`;
}

export function getFileUrl(filename: string): string {
  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * Resolve a stored image URL/path to a full accessible URL.
 * Handles three formats:
 * - Full URL (starts with http): passes through
 * - /uploads/filename: prepends backend base URL
 * - raw filename: prepends backend base URL + /uploads/
 */
export function resolveImageUrl(storedUrl: string | null | undefined): string | null;
export function resolveImageUrl(storedUrl: string | null | undefined, requestBaseUrl: string | undefined): string | null;
export function resolveImageUrl(storedUrl: string | null | undefined, requestBaseUrl?: string | undefined): string | null {
  if (!storedUrl) return null;
  if (storedUrl.startsWith('http')) {
    try {
      const parsed = new URL(storedUrl);
      if (requestBaseUrl && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.pathname.startsWith('/uploads/')) {
        return `${requestBaseUrl}${parsed.pathname}`;
      }
    } catch {
      return storedUrl;
    }
    return storedUrl;
  }
  const base = requestBaseUrl || getBackendBaseUrl();
  if (storedUrl.startsWith('/uploads/')) return `${base}${storedUrl}`;
  return `${base}/uploads/${storedUrl}`;
}

export async function deleteFile(filename: string): Promise<void> {
  try {
    const filepath = resolve(UPLOAD_DIR, filename);
    await fs.unlink(filepath);
  } catch {
    // File doesn't exist, ignore
  }
}

export async function getFileBuffer(filename: string): Promise<Buffer> {
  const filepath = resolve(UPLOAD_DIR, filename);
  return fs.readFile(filepath);
}
