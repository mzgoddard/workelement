import { describe, expect, it } from "vitest";

import { all, call, func, get, json, promise, props, source } from "./util";
import { SourceObject } from "../structs/SourceObject";
import { run } from "../core/run";
import { Slug } from "../core/slug";

describe("jobutil", () => {
  it("source", async () => {
    expect(Slug(source("{}"))).to.matchSnapshot();
  });

  it("func", async () => {
    expect(Slug(func("returnhi", () => "hi"))).to.matchSnapshot();
  });

  describe.each([
    [call(func("returnhi", () => "hi"))],
    [
      call(
        func("JSON.parse", (source: SourceObject) => ({
          data: JSON.parse(source.content),
        })),
        source("{}")
      ),
    ],
  ])("call", async (job) => {
    it("matches job", () => {
      expect(job).to.matchSnapshot();
    });
    it("matches slug", () => {
      expect(Slug(job)).to.matchSnapshot();
    });
    it("matches output", async () => {
      await expect(run(job)).resolves.to.matchSnapshot();
    });
  });

  describe.each([[json(source("{}"))], [json(source("[]"))]])(
    "json",
    async (job) => {
      it("matches job", () => {
        expect(job).to.matchSnapshot();
      });
      it("matches slug", () => {
        expect(Slug(job)).to.matchSnapshot();
      });
      it("matches output", async () => {
        await expect(run(job)).resolves.to.matchSnapshot();
      });
    }
  );

  describe.each([
    [all([])],
    [all([call(func("returnhi", () => "hi"))])],
    [all([json(source("{}"))])],
  ])("all", async (job) => {
    it("matches job", () => {
      expect(job).to.matchSnapshot();
    });
    it("matches slug", () => {
      expect(Slug(job)).to.matchSnapshot();
    });
    it("matches output", async () => {
      await expect(run(job)).resolves.to.matchSnapshot();
    });
  });
});
