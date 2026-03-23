import { describe, it, expect } from 'vitest';
import { Str, Arr, Collection, collect } from '../src/index.js';

describe('@carpentry/helpers: Str', () => {
  it('camel', () => { expect(Str.camel('hello_world')).toBe('helloWorld'); expect(Str.camel('foo-bar')).toBe('fooBar'); });
  it('snake', () => { expect(Str.snake('helloWorld')).toBe('hello_world'); });
  it('kebab', () => { expect(Str.kebab('helloWorld')).toBe('hello-world'); });
  it('pascal', () => { expect(Str.pascal('hello_world')).toBe('HelloWorld'); });
  it('title', () => { expect(Str.title('hello world')).toBe('Hello World'); });
  it('headline', () => { expect(Str.headline('hello-world')).toBe('Hello world'); expect(Str.headline('fooBar')).toBe('Foo bar'); });
  it('slug', () => { expect(Str.slug('Hello World!')).toBe('hello-world'); expect(Str.slug('Foo  Bar', '_')).toBe('foo_bar'); });
  it('plural', () => { expect(Str.plural('user')).toBe('users'); expect(Str.plural('category')).toBe('categories'); expect(Str.plural('bus')).toBe('buses'); });
  it('singular', () => { expect(Str.singular('users')).toBe('user'); expect(Str.singular('categories')).toBe('category'); expect(Str.singular('buses')).toBe('bus'); });
  it('limit', () => { expect(Str.limit('Hello World', 8)).toBe('Hello...'); expect(Str.limit('Hi', 10)).toBe('Hi'); });
  it('replace', () => { expect(Str.replace('Hello :name, :count items', { name: 'Alice', count: 3 })).toBe('Hello Alice, 3 items'); });
  it('contains', () => { expect(Str.contains('Hello World', 'World')).toBe(true); expect(Str.contains('Hello', 'hello', true)).toBe(true); });
  it('isFilled', () => { expect(Str.isFilled('hello')).toBe(true); expect(Str.isFilled('')).toBe(false); expect(Str.isFilled(null)).toBe(false); expect(Str.isFilled('  ')).toBe(false); });
  it('random', () => { const r = Str.random(20); expect(r.length).toBe(20); expect(Str.random()).not.toBe(Str.random()); });
  it('words', () => { expect(Str.words('fooBarBaz')).toEqual(['foo', 'Bar', 'Baz']); expect(Str.words('hello-world')).toEqual(['hello', 'world']); });
  it('mask', () => { expect(Str.mask('alice@example.com', 3, 5)).toBe('ali*****ample.com'); });
  it('is', () => { expect(Str.is('user.*', 'user.created')).toBe(true); expect(Str.is('user.*', 'post.created')).toBe(false); });
});

describe('@carpentry/helpers: Arr', () => {
  it('get (dot notation)', () => {
    const obj = { user: { address: { city: 'NYC' } } };
    expect(Arr.get(obj, 'user.address.city')).toBe('NYC');
    expect(Arr.get(obj, 'user.phone', 'N/A')).toBe('N/A');
  });

  it('set (dot notation)', () => {
    const obj: Record<string, unknown> = {};
    Arr.set(obj, 'user.address.city', 'NYC');
    expect((obj as any).user.address.city).toBe('NYC');
  });

  it('only/except', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(Arr.only(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    expect(Arr.except(obj, ['b'])).toEqual({ a: 1, c: 3 });
  });

  it('flatten', () => { expect(Arr.flatten([1, [2, 3], [4, [5]]])).toEqual([1, 2, 3, 4, 5]); });
  it('unique', () => { expect(Arr.unique([1, 2, 2, 3, 3])).toEqual([1, 2, 3]); });

  it('groupBy', () => {
    const users = [{ name: 'Alice', role: 'admin' }, { name: 'Bob', role: 'user' }, { name: 'Carol', role: 'admin' }];
    const grouped = Arr.groupBy(users, 'role');
    expect(grouped['admin']).toHaveLength(2);
    expect(grouped['user']).toHaveLength(1);
  });

  it('keyBy', () => {
    const users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    const keyed = Arr.keyBy(users, 'id');
    expect(keyed['1'].name).toBe('Alice');
  });

  it('chunk', () => { expect(Arr.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]); });
  it('sum', () => { expect(Arr.sum([1, 2, 3])).toBe(6); expect(Arr.sum([{ v: 10 }, { v: 20 }], (i) => i.v)).toBe(30); });
  it('sortBy', () => {
    const items = [{ name: 'Bob' }, { name: 'Alice' }];
    expect(Arr.sortBy(items, 'name')[0].name).toBe('Alice');
  });
  it('pluck', () => { expect(Arr.pluck([{ id: 1 }, { id: 2 }], 'id')).toEqual([1, 2]); });
  it('first/last', () => { expect(Arr.first([1, 2, 3])).toBe(1); expect(Arr.last([1, 2, 3])).toBe(3); });
  it('partition', () => {
    const [evens, odds] = Arr.partition([1, 2, 3, 4], (n) => n % 2 === 0);
    expect(evens).toEqual([2, 4]); expect(odds).toEqual([1, 3]);
  });
  it('zip', () => { expect(Arr.zip(['a', 'b'], [1, 2])).toEqual([['a', 1], ['b', 2]]); });
});

describe('@carpentry/helpers: Collection', () => {
  it('chaining: filter → map → toArray', () => {
    const result = collect([1, 2, 3, 4, 5])
      .filter((n) => n > 2)
      .map((n) => n * 10)
      .toArray();
    expect(result).toEqual([30, 40, 50]);
  });

  it('first/last/count/isEmpty', () => {
    const c = collect([1, 2, 3]);
    expect(c.first()).toBe(1);
    expect(c.last()).toBe(3);
    expect(c.count()).toBe(3);
    expect(c.isEmpty()).toBe(false);
    expect(collect([]).isEmpty()).toBe(true);
  });

  it('sum', () => {
    expect(collect([1, 2, 3]).sum()).toBe(6);
    expect(collect([{ v: 10 }, { v: 20 }]).sum((i) => i.v)).toBe(30);
  });

  it('sortBy', () => {
    const sorted = collect([{ name: 'Bob' }, { name: 'Alice' }]).sortBy('name').toArray();
    expect(sorted[0].name).toBe('Alice');
  });

  it('groupBy', () => {
    const groups = collect([{ role: 'a' }, { role: 'b' }, { role: 'a' }]).groupBy('role');
    expect(groups['a']).toHaveLength(2);
  });

  it('chunk', () => {
    const chunks = collect([1, 2, 3, 4, 5]).chunk(2).toArray();
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('unique', () => {
    expect(collect([1, 1, 2, 2, 3]).unique().toArray()).toEqual([1, 2, 3]);
  });

  it('contains', () => {
    expect(collect([1, 2, 3]).contains(2)).toBe(true);
    expect(collect([1, 2, 3]).contains((n) => n > 5)).toBe(false);
  });

  it('take/skip/reverse', () => {
    const c = collect([1, 2, 3, 4, 5]);
    expect(c.take(3).toArray()).toEqual([1, 2, 3]);
    expect(c.skip(3).toArray()).toEqual([4, 5]);
    expect(c.reverse().toArray()).toEqual([5, 4, 3, 2, 1]);
  });

  it('partition', () => {
    const [evens, odds] = collect([1, 2, 3, 4]).partition((n) => n % 2 === 0);
    expect(evens.toArray()).toEqual([2, 4]);
    expect(odds.toArray()).toEqual([1, 3]);
  });

  it('reduce', () => {
    expect(collect(['a', 'b', 'c']).reduce((acc, s) => acc + s, '')).toBe('abc');
  });

  it('each', () => {
    const log: number[] = [];
    collect([1, 2, 3]).each((n) => log.push(n));
    expect(log).toEqual([1, 2, 3]);
  });

  it('reject', () => {
    expect(collect([1, 2, 3, 4]).reject((n) => n > 2).toArray()).toEqual([1, 2]);
  });

  it('pluck', () => {
    expect(collect([{ id: 1 }, { id: 2 }]).pluck('id').toArray()).toEqual([1, 2]);
  });
});
