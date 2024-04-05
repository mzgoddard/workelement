import { describe, expect, it } from "vitest";

import { run } from "../core/jobcall.js";
import {
  importdir,
  packagedir,
  readSource,
  relativeto,
} from "./jobfs.js";
import { PathStruct } from "../structs/PathObject.js";
import { Slug } from "../core/slug.js";

describe("jobfs", () => {
  it("readSource", async () => {
    expect(readSource(fixturepath("emptyobject.json"))).to.matchSnapshot();
    expect(
      Slug(readSource(fixturepath("emptyobject.json")))
    ).to.matchSnapshot();
    await expect(
      run(readSource(fixturepath("emptyobject.json")))
    ).resolves.to.matchSnapshot();
    expect(
      Slug(await run(readSource(fixturepath("emptyobject.json"))))
    ).to.matchSnapshot();
  });
});

const fixturepath = (subpath: string) =>
  PathStruct(
    subpath,
    PathStruct(
      "__fixtures__",
      relativeto(packagedir(importdir(import.meta.url)), importdir(import.meta.url))
    )
  );
