import { MaySlug, SLUGIFY, Sluggable, slug } from "../core/slug";

export const GET_ABSOLUTE_PATH: unique symbol = Symbol.for(
  "workelement.getAbsolutePath"
);

export interface PathObject extends MaySlug {
  relativeTo?: PathObject;
  subpath?: string;
  [GET_ABSOLUTE_PATH]?(): string;
}

class PathHandleBase implements PathObject {
  #description: Sluggable;
  #absolutePath: () => string;
  constructor(description: Sluggable, absolutePath: () => string) {
    this.#description = description;
    this.#absolutePath = absolutePath;
  }
  [GET_ABSOLUTE_PATH]() {
    return this.#absolutePath();
  }
  [SLUGIFY]() {
    return slug.dependency`absolutePath(${this.#description})`;
  }
}

export const PathHandleStruct = (
  description: Sluggable,
  absolutePath: () => string
): PathObject => new PathHandleBase(description, absolutePath);

class PathBase implements PathObject {
  subpath: PathObject["subpath"];
  relativeTo?: PathObject["relativeTo"];
  constructor(
    subpath: PathObject["subpath"],
    relativeTo?: PathObject["relativeTo"]
  ) {
    this.subpath = subpath;
    this.relativeTo = relativeTo;
  }
  [SLUGIFY]() {
    return slug.dependency`path(${this.relativeTo ?? "?"}/${this.subpath})`;
  }
}

export const PathStruct = (
  subpath: PathObject["subpath"],
  relativeTo?: PathObject["relativeTo"]
): PathObject => new PathBase(subpath, relativeTo);
