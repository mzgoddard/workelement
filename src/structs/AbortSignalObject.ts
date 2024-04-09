import { abort } from "process";
import { DEREFERENCE, ReferenceObject } from "../core/ref";
import { MaySlug, SLUGIFY, slug } from "../core/slug";

export interface AbortSignalObject
  extends MaySlug,
    ReferenceObject<AbortSignal> {
  abortSignal: AbortSignal;
}

class AbortSignalBase implements AbortSignalObject {
  name: string;
  abortSignal: AbortSignal;
  constructor(name: string, abortSignal: AbortSignal) {
    this.name = name;
    this.abortSignal = abortSignal;
  }
  [DEREFERENCE]() {
    return this.abortSignal;
  }
  [SLUGIFY]() {
    return slug`abortSignal[${this.name}]`;
  }
}

export const AbortSignalStruct = (name: string, abortSignal: AbortSignal) =>
  new AbortSignalBase(name, abortSignal);
