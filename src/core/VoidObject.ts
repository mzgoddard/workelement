import { DEREFERENCE, ReferenceObject } from "./ref";
import { MaySlug, SLUGIFY, slug } from "./slug";

export interface VoidObject extends MaySlug, ReferenceObject<undefined> {}

class VoidBase implements VoidObject {
  [DEREFERENCE]() {
    return undefined;
  }
  [SLUGIFY]() {
    return slug`void`;
  }
}

export const VoidStruct = (): VoidObject => new VoidBase();
