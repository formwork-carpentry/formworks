/**
 * @module @carpentry/core/contracts/pipeline
 * @description Pipeline contract — generic Chain of Responsibility.
 */

/** A pipe function: receives passable + next callback. */
export type PipeFunction<T, R = T> = (passable: T, next: (passable: T) => Promise<R>) => Promise<R>;

/** Class-based pipe — must implement handle(). */
export interface IPipe<T, R = T> {
  handle(passable: T, next: (passable: T) => Promise<R>): Promise<R>;
}

/** Pipeline orchestrator contract. */
export interface IPipeline<T, R = T> {
  send(passable: T): this;
  through(pipes: (IPipe<T, R> | PipeFunction<T, R>)[]): this;
  pipe(...pipes: (IPipe<T, R> | PipeFunction<T, R>)[]): this;
  then(destination: (passable: T) => Promise<R>): Promise<R>;
}
