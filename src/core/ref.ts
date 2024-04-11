import { JobInputOption } from "./run";
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

// export const referTo = <T>(
//   target: ReferenceObject<T> & MaySlug
// ): RefersObject<T> =>
//   RefersStruct(target[REFERS_TO](), () => slug`referTo(${target})`);
// referTo.options = {
//   before: async <T>([target]: [target: JobInputOption<ReferenceObject<T>>]) => [
//     await run(target),
//   ],
//   middleware:
//     (
//       handle: typeof referTo
//     ): (<T>(
//       args: [target: JobInputOption<ReferenceObject<T>>],
//       slug: Slug
//     ) => Promise<ReferenceObject<T>>) =>
//     async ([target], slug) =>
//       overwriteSlug(referTo(await run(target)), slug),
// };

export interface ReferenceObject<T> {
  [DEREFERENCE](): T;
}

export const ReferenceStruct = <T>(value: T): ReferenceObject<T> => ({
  [DEREFERENCE]() {
    return value;
  },
});

export const ref = <T>(target: RefersObject<T> & MaySlug): ReferenceObject<T> =>
  ReferenceStruct(target[REFERS_TO]());

export const asValue = <T>(target: RefersObject<T>): ReferenceObject<T> =>
  ReferenceStruct(target[REFERS_TO]());
