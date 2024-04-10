import { inspect } from "util";
import { abbreviate } from "../support/abbreviate";
import { deprecate } from "./deprecate";

export const SLUG_VALUE: unique symbol = Symbol.for("workelement.slug");
export const SLUGIFY: unique symbol = Symbol.for("workelement.slugify");

type RawSlug = string;
export interface MaySlug {
  [SLUGIFY](): Slug;
}
export interface Slug extends MaySlug {
  [SLUG_VALUE]: RawSlug;
}
interface SlugCacheable extends Slug {
  isCacheable?: boolean;
}
interface SlugOutput extends Slug {
  isOutput?: boolean;
}
interface SlugDependency extends Slug {
  isDependency?: boolean;
}
export type Sluggable = MaySlug | { toString(): string } | null | undefined;
function isSlug(maybe: unknown): maybe is Slug {
  return Boolean(maybe && (maybe as Slug)[SLUG_VALUE]);
}
export function isCacheable(maybe: Slug): boolean {
  try {
    // console.log(Object.keys(maybe));
    return (maybe as SlugCacheable).isCacheable ?? true;
  } catch (e) {
    console.error(e);
    throw e;
  }
}
export function isOutput(maybe: Slug): boolean {
  return (maybe as SlugOutput).isOutput ?? false;
}
export function isDependency(maybe: Slug): boolean {
  return (maybe as SlugDependency).isDependency ?? false;
}
function inspectSlug(this: Slug & SlugCacheable & SlugDependency & SlugOutput) {
  return `[Slug ${this[SLUG_VALUE]}${this.isCacheable ? "" : " uncacheable"}${
    this.isOutput ? " output" : ""
  }${this.isDependency ? " dependency" : ""}]`;
}
class SlugBase implements Slug {
  [SLUG_VALUE]: RawSlug;
  constructor(slug: RawSlug) {
    this[SLUG_VALUE] = slug;
  }
  get __slug() {
    deprecate("SlugBase.__slug", (key) => `${key} is deprecated`);
    return this[SLUG_VALUE];
  }
  get isCacheable() {
    return true;
  }
  get isOutput() {
    return false;
  }
  get isDependency() {
    return false;
  }
  [SLUGIFY]() {
    return Slug(this[SLUG_VALUE]);
    // return this;
  }
  [inspect.custom]() {
    return inspectSlug.call(this);
  }
}
class SlugProxy implements Slug {
  target: Slug;
  constructor(target: Slug) {
    this.target = target;
  }
  get [SLUG_VALUE](): RawSlug {
    return this.target[SLUG_VALUE];
  }
  get __slug() {
    deprecate("SlugProxy.__slug", (key) => `${key} is deprecated`);
    return this[SLUG_VALUE];
  }
  get isCacheable(): boolean {
    return (this.target as SlugCacheable).isCacheable ?? true;
  }
  get isOutput(): boolean {
    return (this.target as SlugOutput).isOutput ?? false;
  }
  get isDependency(): boolean {
    return (this.target as SlugDependency).isDependency ?? false;
  }
  [SLUGIFY]() {
    return this.target[SLUGIFY]();
  }
  [inspect.custom]() {
    return inspectSlug.call(this);
  }
}
class SlugCacheableMod extends SlugProxy {
  #cacheable: boolean;
  constructor(target: Slug, cacheable: boolean) {
    super(target);
    this.#cacheable = cacheable;
  }
  get isCacheable(): boolean {
    return this.#cacheable;
  }
}
class SlugOutputMod extends SlugProxy {
  #output: boolean;
  constructor(target: Slug, output: boolean) {
    super(target);
    this.#output = output;
  }
  get isOutput(): boolean {
    return this.#output;
  }
}
class SlugDependencyMod extends SlugProxy {
  #dependency: boolean;
  constructor(target: Slug, dependency: boolean) {
    super(target);
    this.#dependency = dependency;
  }
  get isDependency(): boolean {
    return this.#dependency;
  }
}
function SlugStruct(__slug: RawSlug): Slug {
  return new SlugBase(__slug);
  return {
    [SLUG_VALUE]: __slug,
    [SLUGIFY]() {
      return Slug(__slug);
    },
    [inspect.custom]() {
      return `Slug ${this.__slug}`;
    },
  } as Slug;
}
export function SlugUncacheable(value: Slug): Slug {
  return new SlugCacheableMod(value, false);
  return { ...value, isCacheable: false } as Slug;
}
export function SlugOutputStruct(value: Slug): Slug {
  // return new SlugOutputMod(value, true);
  return { ...value, isOutput: true } as Slug;
}
export function SlugDependencyStruct(value: Slug): Slug {
  return new SlugDependencyMod(value, true);
  return { ...value, isDependency: true } as Slug;
}
export function Slug(value: RawSlug | Slug | Sluggable): Slug {
  // console.log("Slug", isSlug(value), isMaySlug(value), typeof value, value);
  if (isSlug(value)) {
    return value;
  } else if (isMaySlug(value)) {
    return value[SLUGIFY]();
  }
  return SlugStruct(String(value));
}
export function SlugArray(array: (RawSlug | Slug | Sluggable)[]): Slug {
  return SlugStruct(
    `[${array.map((value) => Slug(value)[SLUG_VALUE]).join(",")}]`
  );
}
// export function SlugObscured(name: string, variable)
function SlugLazy(handle: () => RawSlug): Slug {
  return {
    get [SLUG_VALUE]() {
      return handle();
    },
    [SLUGIFY]() {
      return SlugStruct(handle());
    },
  };
}
export function isMaySlug(maybe: unknown): maybe is MaySlug {
  // console.log("isMaySlug", maybe, (maybe as MaySlug)[SLUGIFY]);
  return Boolean(maybe && (maybe as MaySlug)[SLUGIFY]);
}
export function toSlug(sluggable: Sluggable): Slug {
  if (isMaySlug(sluggable)) {
    return sluggable[SLUGIFY]();
  }
  return SlugStruct(String(sluggable));
}
export function slug(
  strings: TemplateStringsArray,
  ...args: Sluggable[]
): Slug {
  return SlugStruct(
    strings.map((s, i) => s + Slug(args[i] ?? "")[SLUG_VALUE]).join("")
  );
}
slug.uncacheable = (strings: TemplateStringsArray, ...args: Sluggable[]) =>
  SlugUncacheable(slug(strings, ...args));
slug.dependency = (strings: TemplateStringsArray, ...args: Sluggable[]) =>
  SlugDependencyStruct(slug(strings, ...args));
export class SlugMap<V> implements Map<Slug, V> {
  map = new Map<RawSlug, V>();

  get size() {
    return this.map.size;
  }
  get [Symbol.toStringTag]() {
    return this.map[Symbol.toStringTag];
  }
  [Symbol.iterator](): IterableIterator<[Slug, V]> {
    return this.entries();
  }
  clear(): void {
    this.map.clear();
  }
  delete(key: Slug): boolean {
    return this.map.delete(key[SLUG_VALUE]);
  }
  get(key: Slug) {
    return this.map.get(key[SLUG_VALUE]);
  }
  has(key: Slug): boolean {
    return this.map.has(key[SLUG_VALUE]);
  }
  set(key: Slug, value: V): this {
    this.map.set(key[SLUG_VALUE], value);
    return this;
  }
  *entries(): IterableIterator<[Slug, V]> {
    for (const [key, value] of this.map.entries()) {
      yield [Slug(key), value];
    }
  }
  forEach(
    callbackfn: (value: V, key: Slug, map: Map<Slug, V>) => void,
    thisArg?: any
  ): void {
    this.map.forEach((value, key) => callbackfn(value, Slug(key), this));
  }
  *keys(): IterableIterator<Slug> {
    for (const key of this.map.keys()) {
      yield Slug(key);
    }
  }
  values(): IterableIterator<V> {
    return this.map.values();
  }
}

export class SlugSet<T extends MaySlug> implements Set<T> {
  map = new SlugMap<T>();

  get [Symbol.toStringTag]() {
    return this.map[Symbol.toStringTag];
  }
  [Symbol.iterator](): IterableIterator<T> {
    return this.values();
  }

  add(value: T): this;
  add(value: T): this;
  add(value: unknown): this {
    const slug = Slug(value);
    if (!this.map.has(slug)) {
      this.map.set(slug, value as T);
    }
    return this;
  }

  clear(): void;
  clear(): void;
  clear(): void {
    this.map.clear();
  }

  delete(value: T): boolean;
  delete(value: T): boolean;
  delete(value: unknown): boolean {
    const slug = Slug(value);
    if (this.map.has(slug)) {
      this.map.delete(slug);
      return true;
    }
    return false;
  }

  entries(): IterableIterator<[T, T]>;
  entries(): IterableIterator<[T, T]>;
  *entries(): IterableIterator<[T, T]> {
    for (const value of this.map.values()) {
      yield [value, value];
    }
  }

  forEach(
    callbackfn: (value: T, value2: T, set: Set<T>) => void,
    thisArg?: any
  ): void;
  forEach(
    callbackfn: (value: T, value2: T, set: Set<T>) => void,
    thisArg?: any
  ): void;
  forEach(callbackfn: unknown, thisArg?: unknown): void {
    this.map.forEach((value) =>
      (callbackfn as any).call(thisArg, value, value, this)
    );
  }

  has(value: T): boolean;
  has(value: T): boolean;
  has(value: unknown): boolean {
    const slug = Slug(value);
    return this.map.has(slug);
  }

  keys(): IterableIterator<T>;
  keys(): IterableIterator<T>;
  *keys(): IterableIterator<T> {
    yield* this.map.values();
  }

  get size(): number {
    return this.map.size;
  }

  values(): IterableIterator<T>;
  values(): IterableIterator<T>;
  *values(): IterableIterator<T> {
    yield* this.map.values();
  }
}
