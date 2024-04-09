import { DEREFERENCE, ReferenceObject } from "../core/ref";
import { MaySlug, SLUGIFY, slug } from "../core/slug";

export interface NamedPrimitiveObject<T> extends MaySlug, ReferenceObject<T> {
  name: string;
  value: T;
}

class NamedPrimitiveBase<T> implements NamedPrimitiveObject<T> {
  name: string;
  value: T;
  constructor(name: string, value: T) {
    this.name = name;
    this.value = value;
  }
  [DEREFERENCE]() {
    return this.value;
  }
  [SLUGIFY]() {
    return slug.dependency`@${this.name}`;
  }
}

export const NamedPrimitiveStruct = <T>(
  name: string,
  value: T
): NamedPrimitiveObject<T> => new NamedPrimitiveBase(name, value);
