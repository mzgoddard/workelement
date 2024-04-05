import { describe, expect, it } from "vitest";

import { Slug, SlugMap, slug } from "./slug";

describe("SlugMap", () => {
  it("slugs", () => {
    const m = new SlugMap();
    m.set(Slug(1), 1);
    expect(m.get(Slug(1))).toBe(1);
  });
  it("slugs", () => {
    const m = new SlugMap();
    m.set(Slug(1), 1);
    expect(m.get(slug`1`)).toBe(1);
  });
});
