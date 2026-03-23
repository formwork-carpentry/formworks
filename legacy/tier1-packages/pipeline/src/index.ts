/**
 * @module @carpentry/pipeline
 * @description Generic pipeline — Chain of Responsibility pattern for ordered processing.
 *
 * Used by middleware, queue jobs, data transformers, and validation chains.
 * Each pipe receives the passable object and a `next` function to continue the chain.
 *
 * @patterns Chain of Responsibility, Composite (pipeline as a unit)
 * @principles OCP — add pipes without modifying pipeline; SRP — orchestration only
 *
 * @example
 * ```ts
 * import { Pipeline } from '@carpentry/pipeline';
 *
 * const result = await Pipeline.create<string>()
 *   .send('hello')
 *   .through([
 *     async (value, next) => next(value.toUpperCase()),
 *     async (value, next) => next(value + '!'),
 *   ])
 *   .then(async (value) => value);
 * // result === 'HELLO!'
 * ```
 */

/** A pipe function receives the passable and a next callback. */
export type PipeFunction<T, R = T> = (passable: T, next: (passable: T) => Promise<R>) => Promise<R>;

/** A class-based pipe must implement handle(). */
export interface IPipe<T, R = T> {
  handle(passable: T, next: (passable: T) => Promise<R>): Promise<R>;
}

/** A pipe can be a function or a class with handle(). */
export type PipeEntry<T, R = T> = IPipe<T, R> | PipeFunction<T, R>;

/**
 * Generic pipeline — processes a value through an ordered chain of pipes.
 *
 * Unlike the HTTP-specific Pipeline in `@carpentry/http`, this is fully generic:
 * it works with any passable type, not just IRequest/IResponse.
 */
export class Pipeline<T, R = T> {
  private passable!: T;
  private pipes: PipeEntry<T, R>[] = [];

  static create<T, R = T>(): Pipeline<T, R> {
    return new Pipeline<T, R>();
  }

  /** Set the object being passed through the pipeline. */
  send(passable: T): this {
    this.passable = passable;
    return this;
  }

  /** Set the pipes to pass through. */
  through(pipes: PipeEntry<T, R>[]): this {
    this.pipes = pipes;
    return this;
  }

  /** Append additional pipes to the end. */
  pipe(...pipes: PipeEntry<T, R>[]): this {
    this.pipes.push(...pipes);
    return this;
  }

  /** Execute the pipeline with a terminal handler at the end. */
  // biome-ignore lint/suspicious/noThenProperty: Pipeline.then() is the intentional fluent API entry point
  async then(destination: (passable: T) => Promise<R>): Promise<R> {
    const composed = this.buildPipeline(destination);
    return composed(this.passable);
  }

  /** Execute the pipeline and return the passable (no terminal handler). */
  async thenReturn(): Promise<T> {
    let result = this.passable;
    const identity = async (passable: T) => passable as unknown as R;
    const composed = this.buildPipeline(identity);
    const out = await composed(this.passable);
    return out as unknown as T;
  }

  private buildPipeline(
    destination: (passable: T) => Promise<R>,
  ): (passable: T) => Promise<R> {
    return this.pipes.reduceRight<(passable: T) => Promise<R>>((next, pipe) => {
      return async (passable: T) => {
        const nextFn = (p: T) => next(p);

        if (typeof pipe === 'function' && !('handle' in pipe)) {
          return (pipe as PipeFunction<T, R>)(passable, nextFn);
        }

        return (pipe as IPipe<T, R>).handle(passable, nextFn);
      };
    }, destination);
  }
}
