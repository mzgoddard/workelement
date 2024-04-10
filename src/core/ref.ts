import { MaySlug, SLUGIFY, Slug, slug } from "./slug";

export const REFERS_TO: unique symbol = Symbol.for("workelement.refersTo");
export const DEREFERENCE: unique symbol = Symbol.for("workelement.dereference");

export interface RefersObject<T> {
  [REFERS_TO](): T;
}

export const RefersStruct = <T>(
  value: T,
  slug: () => Slug
): RefersObject<T> & MaySlug => ({
  [REFERS_TO]() {
    return value;
  },
  [SLUGIFY]() {
    return slug();
  },
});

export const referTo = <T>(
  target: RefersObject<T> & MaySlug
): ReferenceObject<T> =>
  ReferenceStruct(target[REFERS_TO](), () => slug`referTo(${target})`);

export interface ReferenceObject<T> {
  [DEREFERENCE](): T;
}

export const ReferenceStruct = <T>(
  value: T,
  slug: () => Slug
): ReferenceObject<T> & MaySlug => ({
  [DEREFERENCE]() {
    return value;
  },
  [SLUGIFY]() {
    return slug();
  },
});

export const ref = <T>(target: RefersObject<T> & MaySlug): ReferenceObject<T> =>
  ReferenceStruct(target[REFERS_TO](), () => slug`ref(${target})`);

export const asValue = <T>(
  target: RefersObject<T> & MaySlug
): ReferenceObject<T> =>
  ReferenceStruct(target[REFERS_TO](), () => slug`asValue(${target})`);
