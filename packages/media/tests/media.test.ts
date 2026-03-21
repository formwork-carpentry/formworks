import { describe, it, expect, beforeEach } from 'vitest';
import {
  MediaCollection, TransformationPipeline, PassthroughTransformation, RenameTransformation,
  DocumentGenerator, ArrayDocumentAdapter, CsvDocumentAdapter, HtmlDocumentAdapter,
  mimeFromExtension, extensionFromMime, isImage, isDocument, isVideo, isAudio, formatFileSize,
} from '../src/index.js';
import type { MediaItem, TransformInput } from '../src/index.js';

// ── Helpers ───────────────────────────────────────────────

function makeMedia(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'media-1', name: 'photo', fileName: 'photo.jpg', mimeType: 'image/jpeg',
    size: 1024, path: '/uploads/photo.jpg', disk: 'local', collection: 'default',
    metadata: {}, createdAt: new Date(), ...overrides,
  };
}

// ── MediaCollection ───────────────────────────────────────

describe('@formwork/media: MediaCollection', () => {
  let collection: MediaCollection;

  beforeEach(() => {
    collection = new MediaCollection('gallery');
    collection.add(makeMedia({ id: '1', mimeType: 'image/jpeg', fileName: 'a.jpg' }));
    collection.add(makeMedia({ id: '2', mimeType: 'image/png', fileName: 'b.png' }));
    collection.add(makeMedia({ id: '3', mimeType: 'application/pdf', fileName: 'c.pdf' }));
  });

  it('add and count', () => { expect(collection.count()).toBe(3); });
  it('first() and last()', () => {
    expect(collection.first()!.id).toBe('1');
    expect(collection.last()!.id).toBe('3');
  });

  it('all() returns copy', () => {
    const items = collection.all();
    expect(items).toHaveLength(3);
    items.pop(); // modifying copy
    expect(collection.count()).toBe(3); // original unchanged
  });

  it('images() filters by image mime', () => {
    expect(collection.images()).toHaveLength(2);
  });

  it('documents() filters PDFs and office docs', () => {
    expect(collection.documents()).toHaveLength(1);
  });

  it('filter() with predicate', () => {
    const pngs = collection.filter((i) => i.mimeType === 'image/png');
    expect(pngs).toHaveLength(1);
  });

  it('remove()', () => {
    expect(collection.remove('2')).toBe(true);
    expect(collection.count()).toBe(2);
    expect(collection.remove('nonexistent')).toBe(false);
  });

  it('clear()', () => {
    collection.clear();
    expect(collection.count()).toBe(0);
  });

  it('empty collection first/last return null', () => {
    const empty = new MediaCollection('empty');
    expect(empty.first()).toBeNull();
    expect(empty.last()).toBeNull();
  });
});

// ── TransformationPipeline ────────────────────────────────

describe('@formwork/media: TransformationPipeline', () => {
  const input: TransformInput = {
    buffer: Buffer.from('test image data'),
    mimeType: 'image/jpeg',
    fileName: 'photo.jpg',
  };

  it('pipes transformations in order', async () => {
    const t1 = new PassthroughTransformation('step1');
    const t2 = new PassthroughTransformation('step2');

    const pipeline = new TransformationPipeline().pipe(t1).pipe(t2);
    const output = await pipeline.process(input);

    expect(t1.applied).toBe(true);
    expect(t2.applied).toBe(true);
    expect(output.buffer).toBe(input.buffer);
  });

  it('rename transformation changes extension', async () => {
    const pipeline = new TransformationPipeline().pipe(new RenameTransformation('webp'));
    const output = await pipeline.process(input);
    expect(output.fileName).toBe('photo.webp');
  });

  it('getTransformNames()', () => {
    const pipeline = new TransformationPipeline()
      .pipe(new PassthroughTransformation('resize'))
      .pipe(new PassthroughTransformation('watermark'))
      .pipe(new RenameTransformation('png'));

    expect(pipeline.getTransformNames()).toEqual(['resize', 'watermark', 'rename']);
  });

  it('empty pipeline returns input unchanged', async () => {
    const pipeline = new TransformationPipeline();
    const output = await pipeline.process(input);
    expect(output.fileName).toBe('photo.jpg');
  });
});

// ── DocumentGenerator ─────────────────────────────────────

describe('@formwork/media: DocumentGenerator', () => {
  let generator: DocumentGenerator;

  beforeEach(() => {
    generator = new DocumentGenerator()
      .registerAdapter(new ArrayDocumentAdapter('pdf'))
      .registerAdapter(new ArrayDocumentAdapter('docx'))
      .registerAdapter(new ArrayDocumentAdapter('xlsx'))
      .registerAdapter(new CsvDocumentAdapter())
      .registerAdapter(new HtmlDocumentAdapter());
  });

  it('generates PDF document', async () => {
    const doc = await generator.pdf('invoice', { orderId: 42, total: 99.99 });
    expect(doc.format).toBe('pdf');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.fileName).toBe('invoice.pdf');
  });

  it('generates DOCX document', async () => {
    const doc = await generator.docx('contract', { client: 'Acme Corp' });
    expect(doc.format).toBe('docx');
    expect(doc.fileName).toBe('contract.docx');
  });

  it('generates XLSX document', async () => {
    const doc = await generator.xlsx('report', { quarter: 'Q3' });
    expect(doc.format).toBe('xlsx');
  });

  it('throws for unregistered format', async () => {
    await expect(generator.generate({ name: 'test', data: {}, format: 'svg' }))
      .rejects.toThrow('No adapter for format "svg"');
  });

  it('getGenerated() tracks all documents', async () => {
    await generator.pdf('a', {});
    await generator.docx('b', {});
    expect(generator.getGenerated()).toHaveLength(2);
  });
});

// ── CsvDocumentAdapter ────────────────────────────────────

describe('@formwork/media: CsvDocumentAdapter', () => {
  const adapter = new CsvDocumentAdapter();

  it('generates CSV from rows', async () => {
    const doc = await adapter.generate({
      name: 'users',
      data: {
        rows: [
          { name: 'Alice', email: 'a@b.com', age: 30 },
          { name: 'Bob', email: 'b@b.com', age: 25 },
        ],
      },
      format: 'csv',
    });

    const csv = doc.buffer.toString('utf-8');
    expect(csv).toContain('name,email,age');
    expect(csv).toContain('Alice,a@b.com,30');
    expect(csv).toContain('Bob,b@b.com,25');
    expect(doc.mimeType).toBe('text/csv');
  });

  it('uses custom headers', async () => {
    const doc = await adapter.generate({
      name: 'export',
      data: {
        headers: ['name', 'email'],
        rows: [{ name: 'Alice', email: 'a@b.com', age: 30 }],
      },
      format: 'csv',
    });

    const csv = doc.buffer.toString('utf-8');
    expect(csv).toContain('name,email');
    expect(csv).not.toContain('age'); // excluded from headers
  });

  it('escapes commas and quotes', async () => {
    const doc = await adapter.generate({
      name: 'test',
      data: {
        rows: [{ name: 'Alice, "the great"', value: 'normal' }],
      },
      format: 'csv',
    });

    const csv = doc.buffer.toString('utf-8');
    expect(csv).toContain('"Alice, ""the great"""'); // proper CSV escaping
  });

  it('throws without rows', async () => {
    await expect(adapter.generate({ name: 'x', data: {}, format: 'csv' }))
      .rejects.toThrow('data.rows');
  });
});

// ── HtmlDocumentAdapter ───────────────────────────────────

describe('@formwork/media: HtmlDocumentAdapter', () => {
  it('generates HTML from template function', async () => {
    const adapter = new HtmlDocumentAdapter();
    adapter.registerTemplate('voucher', (data) =>
      `<div class="voucher"><h1>Gift Voucher</h1><p>Value: $${data['amount']}</p><p>Code: ${data['code']}</p></div>`
    );

    const doc = await adapter.generate({
      name: 'voucher',
      data: { amount: 50, code: 'GIFT-ABC123' },
      format: 'html',
    });

    const html = doc.buffer.toString('utf-8');
    expect(html).toContain('Gift Voucher');
    expect(html).toContain('$50');
    expect(html).toContain('GIFT-ABC123');
  });

  it('falls back to JSON dump for unknown templates', async () => {
    const adapter = new HtmlDocumentAdapter();
    const doc = await adapter.generate({ name: 'unknown', data: { key: 'value' }, format: 'html' });
    const html = doc.buffer.toString('utf-8');
    expect(html).toContain('"key": "value"');
  });
});

// ── ArrayDocumentAdapter ──────────────────────────────────

describe('@formwork/media: ArrayDocumentAdapter', () => {
  it('records generated docs for assertions', async () => {
    const adapter = new ArrayDocumentAdapter('pdf');
    await adapter.generate({ name: 'invoice', data: {}, format: 'pdf' });
    await adapter.generate({ name: 'receipt', data: {}, format: 'pdf' });

    adapter.assertCount(2);
    adapter.assertGenerated('invoice');
    adapter.assertGenerated('receipt');
  });

  it('assertGenerated throws on missing', () => {
    const adapter = new ArrayDocumentAdapter('pdf');
    expect(() => adapter.assertGenerated('nope')).toThrow();
  });
});

// ── MIME utilities ─────────────────────────────────────────

describe('@formwork/media: MIME utilities', () => {
  it('mimeFromExtension()', () => {
    expect(mimeFromExtension('jpg')).toBe('image/jpeg');
    expect(mimeFromExtension('.png')).toBe('image/png');
    expect(mimeFromExtension('pdf')).toBe('application/pdf');
    expect(mimeFromExtension('xlsx')).toContain('spreadsheet');
    expect(mimeFromExtension('unknown')).toBe('application/octet-stream');
  });

  it('extensionFromMime()', () => {
    expect(extensionFromMime('image/jpeg')).toBe('jpg');
    expect(extensionFromMime('application/pdf')).toBe('pdf');
    expect(extensionFromMime('fake/type')).toBeNull();
  });

  it('isImage()', () => {
    expect(isImage('jpg')).toBe(true);
    expect(isImage('image/png')).toBe(true);
    expect(isImage('pdf')).toBe(false);
  });

  it('isDocument()', () => {
    expect(isDocument('pdf')).toBe(true);
    expect(isDocument('xlsx')).toBe(true);
    expect(isDocument('csv')).toBe(true);
    expect(isDocument('jpg')).toBe(false);
  });

  it('isVideo()', () => {
    expect(isVideo('mp4')).toBe(true);
    expect(isVideo('jpg')).toBe(false);
  });

  it('isAudio()', () => {
    expect(isAudio('mp3')).toBe(true);
    expect(isAudio('pdf')).toBe(false);
  });

  it('formatFileSize()', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });
});
