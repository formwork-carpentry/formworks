/**
 * @module @formwork/media
 * @description TransformationPipeline — chain media transformations (resize, rename, convert).
 * @patterns Chain of Responsibility, Strategy
 */

/**
 * A single transformation step. Implement this interface to add custom transforms
 * (resize, watermark, format conversion) to a pipeline.
 */
export interface Transformation {
  name: string;
  apply(input: TransformInput): Promise<TransformOutput>;
}

/** Input passed to each transformation in the pipeline. */
export interface TransformInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  metadata?: Record<string, unknown>;
}

/** Output produced by a transformation; becomes input for the next. */
export interface TransformOutput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

/**
 * Chains transformations in sequence. Each step receives the previous output.
 * Use for image processing (resize → watermark → convert) or document prep.
 *
 * @example
 * ```ts
 * const pipeline = new TransformationPipeline()
 *   .pipe(new RenameTransformation('webp'));
 *
 * const output = await pipeline.process({
 *   buffer: imageBuffer,
 *   mimeType: 'image/jpeg',
 *   fileName: 'photo.jpg',
 * });
 * // output.fileName === 'photo.webp'
 * ```
 *
 * @example
 * ```ts
 * // Custom transforms (e.g. sharp, jimp)
 * pipeline.pipe(new ResizeTransformation(800, 600))
 *         .pipe(new WatermarkTransformation('© 2025'));
 * const result = await pipeline.process(input);
 * ```
 */
export class TransformationPipeline {
  private transforms: Transformation[] = [];

  /**
   * Add a transformation to the pipeline. Chainable.
   *
   * @param transform - The transformation to add.
   * @returns `this` for chaining.
   */
  pipe(transform: Transformation): this {
    this.transforms.push(transform);
    return this;
  }

  /**
   * Run all transformations in order.
   *
   * @param input - Initial buffer, MIME type, and filename.
   * @returns Final output after all transforms.
   */
  async process(input: TransformInput): Promise<TransformOutput> {
    let current: TransformInput = input;

    for (const transform of this.transforms) {
      const output = await transform.apply(current);
      current = { ...output, metadata: current.metadata };
    }

    return { buffer: current.buffer, mimeType: current.mimeType, fileName: current.fileName };
  }

  /** Names of transforms in the pipeline (for debugging). */
  getTransformNames(): string[] {
    return this.transforms.map((t) => t.name);
  }
}

// ── Built-in Transformations ───────────────────────────────

/**
 * Changes the file extension. Useful for format conversion workflows
 * (e.g. jpg → webp) when paired with actual conversion logic.
 *
 * @example
 * ```ts
 * const pipeline = new TransformationPipeline().pipe(new RenameTransformation('webp'));
 * const out = await pipeline.process({ buffer, mimeType: 'image/jpeg', fileName: 'photo.jpg' });
 * // out.fileName === 'photo.webp'
 * ```
 */
export class RenameTransformation implements Transformation {
  name = 'rename';
  constructor(private newExtension: string) {}

  async apply(input: TransformInput): Promise<TransformOutput> {
    const baseName = input.fileName.replace(/\.[^.]+$/, '');
    return { ...input, fileName: `${baseName}.${this.newExtension}` };
  }
}

/**
 * No-op transformation. Passes input through unchanged. Useful for testing
 * pipeline mechanics or as a placeholder.
 */
export class PassthroughTransformation implements Transformation {
  name: string;
  applied = false;

  constructor(name: string = 'passthrough') { this.name = name; }

  async apply(input: TransformInput): Promise<TransformOutput> {
    this.applied = true;
    return input;
  }
}
