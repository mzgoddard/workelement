import { DEREFERENCE, ReferenceObject } from "../core/ref";
import { MaySlug, SLUGIFY, slug } from "../core/slug";
import { md5 } from "../support/md5";

export interface HashPrimitiveObject<T> extends MaySlug, ReferenceObject<T> {}

class HashPrimitiveBase<T> implements HashPrimitiveObject<T> {
  #value: T;
  #hash: any;
  constructor(value: T, hash?: any) {
    this.#value = value;
    this.#hash = hash;
  }
  get hash() {
    if (!this.#hash) {
      this.#hash = md5(String(this.#value));
    }
    return this.#hash;
  }
  [DEREFERENCE]() {
    return this.#value;
  }
  [SLUGIFY]() {
    return slug`@@${this.hash}`;
  }
}

export const HashPrimitiveStruct = <T>(
  value: T,
  hash?: any
): HashPrimitiveObject<T> => new HashPrimitiveBase(value, hash);
