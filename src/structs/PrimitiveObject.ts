import {
  DEREFERENCE,
  REFERS_TO,
  ReferenceObject,
  RefersObject,
} from "../core/ref";
import { MaySlug, SLUGIFY, Sluggable, slug } from "../core/slug";

export interface PrimitiveObject<T> extends MaySlug, RefersObject<T> {
  value: T;
}

class PrimitiveBase<T extends Sluggable> implements PrimitiveObject<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  [REFERS_TO]() {
    return this.value;
  }
  [SLUGIFY]() {
    return slug`primitive[${this.value}]`;
  }
}

export const PrimitiveStruct = <T>(value: T): PrimitiveObject<T> =>
  new PrimitiveBase(value);
