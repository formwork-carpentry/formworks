/**
 * @module @carpentry/media
 * @description MIME type utilities — extension lookup, type checks, file size formatting.
 */

const MIME_MAP: Record<string, string> = {
  'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
  'webp': 'image/webp', 'svg': 'image/svg+xml', 'bmp': 'image/bmp', 'ico': 'image/x-icon',
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'csv': 'text/csv', 'txt': 'text/plain', 'html': 'text/html', 'json': 'application/json',
  'xml': 'application/xml',
  'zip': 'application/zip', 'gz': 'application/gzip', 'tar': 'application/x-tar',
  'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
  'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo',
};

/**
 * Get MIME type from file extension. Handles leading dots (e.g. `.jpg`).
 *
 * @param ext - Extension (e.g. `jpg`, `.png`, `webp`).
 * @returns MIME type or `application/octet-stream` if unknown.
 *
 * @example
 * ```ts
 * mimeFromExtension('jpg');   // 'image/jpeg'
 * mimeFromExtension('.png');  // 'image/png'
 * mimeFromExtension('pdf');   // 'application/pdf'
 * ```
 */
export function mimeFromExtension(ext: string): string {
  return MIME_MAP[ext.toLowerCase().replace('.', '')] ?? 'application/octet-stream';
}

/**
 * Get file extension from MIME type.
 *
 * @param mime - MIME type (e.g. `image/jpeg`).
 * @returns Extension or null if not in map.
 *
 * @example
 * ```ts
 * extensionFromMime('image/jpeg');  // 'jpg'
 * extensionFromMime('text/csv');    // 'csv'
 * ```
 */
export function extensionFromMime(mime: string): string | null {
  for (const [ext, m] of Object.entries(MIME_MAP)) {
    if (m === mime) return ext;
  }
  return null;
}

/**
 * Check if the value is an image MIME type. Accepts MIME or extension.
 *
 * @param mimeOrExt - MIME type (e.g. `image/jpeg`) or extension (e.g. `jpg`).
 *
 * @example
 * ```ts
 * isImage('image/png');  // true
 * isImage('jpg');        // true
 * isImage('application/pdf');  // false
 * ```
 */
export function isImage(mimeOrExt: string): boolean {
  const mime = mimeOrExt.includes('/') ? mimeOrExt : mimeFromExtension(mimeOrExt);
  return mime.startsWith('image/');
}

/**
 * Check if the value is a document MIME type (PDF, Office, CSV).
 *
 * @param mimeOrExt - MIME type or extension.
 */
export function isDocument(mimeOrExt: string): boolean {
  const mime = mimeOrExt.includes('/') ? mimeOrExt : mimeFromExtension(mimeOrExt);
  return mime.includes('pdf') || mime.includes('document') || mime.includes('spreadsheet') || mime.includes('csv');
}

/**
 * Check if the value is a video MIME type.
 *
 * @param mimeOrExt - MIME type or extension.
 */
export function isVideo(mimeOrExt: string): boolean {
  const mime = mimeOrExt.includes('/') ? mimeOrExt : mimeFromExtension(mimeOrExt);
  return mime.startsWith('video/');
}

/**
 * Check if the value is an audio MIME type.
 *
 * @param mimeOrExt - MIME type or extension.
 */
export function isAudio(mimeOrExt: string): boolean {
  const mime = mimeOrExt.includes('/') ? mimeOrExt : mimeFromExtension(mimeOrExt);
  return mime.startsWith('audio/');
}

/**
 * Format bytes as human-readable size (e.g. `1.5 MB`, `256 KB`).
 *
 * @param bytes - Size in bytes.
 * @returns Formatted string.
 *
 * @example
 * ```ts
 * formatFileSize(0);        // '0 B'
 * formatFileSize(1024);     // '1 KB'
 * formatFileSize(1536000);  // '1.5 MB'
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
