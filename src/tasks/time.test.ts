import { describe, expect, it } from "vitest";
import { Slug } from "../core/slug";
import { run, work } from "../core/run";
import { delay, timeout } from "./time";

describe("time", () => {
  describe.each([[work(delay, 0)], [work(delay, 1)]])(
    "delay %#",
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
    [work(delay, 100, work(timeout, "timeout", 0))],
    [work(delay, 100, work(timeout, "timeout", 50))],
  ])("timeout %#", async (job) => {
    it("matches job", () => {
      expect(job).to.matchSnapshot();
    });
    it("matches slug", () => {
      expect(Slug(job)).to.matchSnapshot();
    });
    it("matches output", async () => {
      await expect(run(job)).rejects.to.matchSnapshot();
    });
  });
});
