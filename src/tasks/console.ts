import { work } from "../core/run";
import { slug } from "../core/slug";
import { NamedPrimitiveStruct } from "../structs/NamedPrimitiveObject";

export const console = () =>
  NamedPrimitiveStruct("console", globalThis.console);

export const logTo = (console: Console, ...body: any[]) => {
  console.log(...body);
};

export const log = (...body: any[]) => work(logTo, work(console), ...body);
log.options = {
  slug() {
    return slug.uncacheable`log(...)`;
  },
};
