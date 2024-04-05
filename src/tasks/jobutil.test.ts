import { describe, expect, it } from "vitest";

import {
  all,
  call,
  func,
  get,
  json,
  promise,
  props,
  source,
} from "./jobutil";
import { SourceObject } from "../structs/SourceObject";
import { run } from "../core/jobcall";
import { Slug } from "../core/slug";

describe("jobutil", () => {
  it("source", async () => {
    expect(Slug(source("{}"))).to.matchSnapshot();
  });

  it("func", async () => {
    expect(Slug(func("returnhi", () => "hi"))).to.matchSnapshot();
  });

  it.each([
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
    expect(job).to.matchSnapshot();
    expect(Slug(job)).to.matchSnapshot();
    await expect(run(job)).resolves.to.matchSnapshot();
    // source;
    // json;
    // promise;
    // props;
    // get;
    // // then;
  });

  it.each([[json(source("{}"))], [json(source("[]"))]])("json", async (job) => {
    expect(job).to.matchSnapshot();
    expect(Slug(job)).to.matchSnapshot();
    await expect(run(job)).resolves.to.matchSnapshot();
  });

  it.each([
    [all([])],
    [all([call(func("returnhi", () => "hi"))])],
    [all([json(source("{}"))])],
  ])("all", async (job) => {
    expect(job).to.matchSnapshot();
    expect(Slug(job)).to.matchSnapshot();
    await expect(run(job)).resolves.to.matchSnapshot();
  });
});
