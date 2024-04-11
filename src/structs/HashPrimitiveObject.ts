import {
  DEREFERENCE,
  REFERS_TO,
  ReferenceObject,
  RefersObject,
} from "../core/ref";
import { MaySlug, SLUGIFY, slug } from "../core/slug";
import { md5 } from "../support/md5";

export interface HashPrimitiveObject<T> extends MaySlug, RefersObject<T> {}

class HashPrimitiveBase<T extends { toString(): string }>
  implements HashPrimitiveObject<T>
{
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
  [REFERS_TO]() {
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
