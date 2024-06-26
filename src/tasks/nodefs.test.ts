import { describe, expect, it } from "vitest";

import { run } from "../core/run";
import { PathStruct } from "../structs/PathObject";
import { Slug } from "../core/slug";

import { importdir, packagedir, readSource, relativeto } from "./nodefs";

describe("jobfs", () => {
  describe("readSource", async () => {
    const job = readSource(fixturepath("emptyobject.json"));
    it("matches job", () => {
      expect(job).to.matchSnapshot();
    });
    it("matches job slug", () => {
      expect(
        Slug(readSource(fixturepath("emptyobject.json")))
      ).to.matchSnapshot();
    });
    it("matches output", async () => {
      await expect(
        run(readSource(fixturepath("emptyobject.json")))
      ).resolves.to.matchSnapshot();
    });
    it("matches output slug", async () => {
      expect(
        Slug(await run(readSource(fixturepath("emptyobject.json"))))
      ).to.matchSnapshot();
    });
  });
});

const fixturepath = (subpath: string) =>
  PathStruct(
    subpath,
    PathStruct(
      "__fixtures__",
      relativeto(
        packagedir(importdir(import.meta.url)),
        importdir(import.meta.url)
      )
    )
  );
