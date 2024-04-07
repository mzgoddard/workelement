import { SLUGIFY, Slug, slug } from "../core/slug";
import { DateObject, GET_DATE } from "./DateObject";
import { PathObject } from "./PathObject";

export interface ModifiedTimeObject extends DateObject {
  modifiedTime: Date;
}

class ModifiedTimeBase implements ModifiedTimeObject {
  #path: PathObject;
  modifiedTime: Date;
  constructor(path: PathObject, modifiedTime: Date) {
    this.#path = path;
    this.modifiedTime = modifiedTime;
  }
  [GET_DATE](): Date {
    return this.modifiedTime;
  }
  [SLUGIFY](): Slug {
    return slug`modifiedTime(${this.#path})`;
  }
}

export const ModifiedTimeStruct = (
  path: PathObject,
  modifiedTime: Date
): ModifiedTimeObject => new ModifiedTimeBase(path, modifiedTime);
