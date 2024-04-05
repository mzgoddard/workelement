import { join } from "path";
import { MaySlug, Sluggable, slug } from "../core/slug";

export interface PathObject extends MaySlug {
  relativeTo?: PathObject;
  subpath?: string;
  absolutePath?(): string;
}

export const PathHandleStruct = (
  description: Sluggable,
  absolutePath: () => string
) => ({
  absolutePath,
  toSlug() {
    return slug.dependency`absolutePath(${description})`;
  },
});

export const PathStruct = (
  subpath: PathObject["subpath"],
  relativeTo?: PathObject["relativeTo"]
) => relativeTo && "subpath" in relativeTo
    ? {
      relativeTo: relativeTo.relativeTo,
      subpath: join(relativeTo.subpath, subpath),
      toSlug() {
        return slug.dependency`path(${relativeTo.relativeTo ?? "?"}/${join(
          relativeTo.subpath,
          subpath
        )})`;
      },
    }
    : {
      relativeTo,
      subpath,
      toSlug() {
        return slug.dependency`path(${relativeTo ?? "?"}/${subpath})`;
      },
    };
