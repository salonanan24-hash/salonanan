import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import { getSupabaseAdmin } from './supabase.js';

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i;

function extension(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'gif';
}

/** Upload a data-URL image to the public media bucket and return its public URL. Pass-through for existing URLs/paths. */
export async function persistImage(value: string, folder: string, fileId?: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = DATA_URL.exec(trimmed);
  if (!match) return trimmed;

  const mime = match[1]!.toLowerCase();
  const buffer = Buffer.from(match[2]!.replace(/\s+/g, ''), 'base64');
  if (buffer.length === 0) return '';
  if (buffer.length > 5_000_000) throw new AppError(413, 'image_too_large', 'Image is too large');

  const name = (fileId?.trim() || randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '-');
  const path = `${folder.replace(/^\/+|\/+$/g, '')}/${name}.${extension(mime)}`;
  const client = getSupabaseAdmin();
  const { error } = await client.storage.from('media').upload(path, buffer, {
    contentType: mime,
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw new AppError(500, 'storage', error.message || 'Image upload failed');

  const { data } = client.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

export async function persistImages(values: string[], folder: string, ids?: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    out.push(await persistImage(values[index] ?? '', folder, ids?.[index]));
  }
  return out;
}
