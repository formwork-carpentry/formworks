/**
 * @module @carpentry/pipeline
 * @description Generic pipeline — Chain of Responsibility pattern for ordered processing.
 */

import type { IContainer } from "@carpentry/formworks/contracts";
import type { IPipe, PipeFunction } from "@carpentry/formworks/contracts/pipeline";

export type { IPipe, PipeFunction };
export type PipeEntry<TPassable, TReturn = TPassable> =
  | IPipe<TPassable, TReturn>
  | PipeFunction<TPassable, TReturn>;

/**
 * Generic pipeline used by HTTP middleware, queue job pipelines, and data transforms.
 *
 * @typeParam TPassable - The value flowing through each pipe.
 * @typeParam TReturn - The terminal return type of the pipeline.
 */
export class Pipeline<TPassable, TReturn = TPassable> {
  private passable!: TPassable;
  private pipes: Array<PipeEntry<TPassable, TReturn>> = [];
  private method = "handle";

  constructor(private readonly container?: IContainer) {}

  static create<TPassable, TReturn = TPassable>(): Pipeline<TPassable, TReturn> {
    return new Pipeline<TPassable, TReturn>();
  }

  send(passable: TPassable): this {
    this.passable = passable;
    return this;
  }

  through(pipes: Array<PipeEntry<TPassable, TReturn>>): this {
    this.pipes = pipes;
    return this;
  }

  pipe(pipe: PipeEntry<TPassable, TReturn>): this {
    this.pipes.push(pipe);
    return this;
  }

  via(method: string): this {
    this.method = method;
    return this;
  }

  async thenReturn(): Promise<TReturn> {
    return this.then(async (passable) => passable as unknown as TReturn);
  }

  // biome-ignore lint/suspicious/noThenProperty: Fluent Pipeline.then API is intentional.
  async then(destination: (passable: TPassable) => TReturn | Promise<TReturn>): Promise<TReturn> {
    const pipeline = this.pipes.reduceRight<(passable: TPassable) => Promise<TReturn>>(
      (next, pipe) => async (passable) => this.invokePipe(pipe, passable, next),
      async (passable) => Promise.resolve(destination(passable)),
    );

    return pipeline(this.passable);
  }

  private async invokePipe(
    pipe: PipeEntry<TPassable, TReturn>,
    passable: TPassable,
    next: (passable: TPassable) => Promise<TReturn>,
  ): Promise<TReturn> {
    if (typeof pipe === "function") {
      return pipe(passable, next);
    }

    const method = (pipe as Record<string, unknown>)[this.method];
    if (typeof method === "function") {
      return (method as (value: TPassable, n: (value: TPassable) => Promise<TReturn>) => Promise<TReturn>)(
        passable,
        next,
      );
    }

    if (typeof pipe.handle === "function") {
      return pipe.handle(passable, next);
    }

    if (this.container) {
      throw new Error(`Pipeline could not invoke pipe method \"${this.method}\" with the configured container.`);
    }
    throw new Error(`Pipeline could not invoke pipe method \"${this.method}\".`);
  }
}
