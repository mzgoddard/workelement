import { readFileSync, statSync } from "fs";
import { readFile, mkdir, stat as _stat, writeFile } from "fs/promises";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

import { SLUGIFY, slug } from "../core/slug";
import { announceChanges, run, task } from "../core/jobcall";
import { SourceObject } from "../structs/SourceObject";
import {
  PathHandleStruct,
  PathStruct,
  PathObject,
  GET_ABSOLUTE_PATH,
} from "../structs/PathObject";
import {
  ModifiedTimeObject,
  ModifiedTimeStruct,
} from "../structs/ModifiedTimeObject";

export const path = (subpath) => {
  return {
    path: subpath,
    [SLUGIFY]() {
      return slug.dependency`path(${subpath})`;
    },
  };
};

export const workingdir = () => {
  const cwd = process.cwd();
  return PathHandleStruct("cwd", () => cwd);
};

export const workingdirpath = (subpath: string) =>
  PathStruct(subpath, workingdir());

const fileexists = (filepath: string) => {
  try {
    return statSync(filepath).isFile();
  } catch (_) {
    return false;
  }
};

const findpackage = (nestedpath: string) => {
  if (nestedpath === "") {
    return;
  }
  try {
    const projectfilepath = resolve(nestedpath, "package.json");
    if (fileexists(projectfilepath)) {
      const packageInfo = JSON.parse(readFileSync(projectfilepath, "utf8"));
      return {
        name: packageInfo.name,
        path: nestedpath,
      };
    }
    return findpackage(dirname(nestedpath));
  } catch (_) {
    return;
  }
};

export const packagedir = (path: PathObject) => {
  const packageBrief = findpackage(absolutePath(path));
  return PathHandleStruct(
    `package:${packageBrief.name}`,
    () => packageBrief.path
  );
};

export const relativeto = (relativeto: PathObject, path: PathObject) => {
  return PathStruct(
    relative(absolutePath(relativeto), absolutePath(path)),
    relativeto
  );
};

export const moduledir = (moduleMetaPath: string) =>
  PathHandleStruct("moduledir", () => dirname(moduleMetaPath));

export const importdir = (importMetaUrl: string) =>
  PathHandleStruct(`importdir`, () =>
    fileURLToPath(new URL(".", importMetaUrl))
  );

export const dir = (path: PathObject) =>
  "subpath" in path
    ? PathStruct(dirname(path.subpath), path.relativeTo)
    : PathStruct("..", path);

export const absolutePath = (path: PathObject): string => {
  return path[GET_ABSOLUTE_PATH]
    ? path[GET_ABSOLUTE_PATH]()
    : path.relativeTo
    ? resolve(absolutePath(path.relativeTo), path.subpath)
    : resolve(path.subpath);
};

export const readSource = task(
  async (path: PathObject): Promise<{ content: string }> => ({
    content: await run(readFile(absolutePath(path), "utf8")),
  }),
  {
    name: "readSource",
  }
);

export const writeSource = task(
  async (path: PathObject, source: SourceObject) => {
    await run(writeFile(absolutePath(path), source.content, "utf8"));
    announceChanges([path]);
    return {};
  },
  { name: "writeSource" }
);

export const ensureDir = task(
  async (path: PathObject) => {
    await run(mkdir(absolutePath(path), { recursive: true }));
    // announceChanges([path]);
    return { path };
  },
  { name: "ensureDir" }
);

export const stat = task(
  async (path: PathObject) => ({
    stat: await run(_stat(absolutePath(path))),
  }),
  { name: "stat" }
);

export const modifiedTime = task(
  async (path: PathObject): Promise<ModifiedTimeObject> =>
    ModifiedTimeStruct(path, (await run(stat(path))).stat.mtime),
  { name: "modifiedTime" }
);
