import { ReferenceObject, asValue } from "../core/ref";
import { Job, work } from "../core/run";
import { slug } from "../core/slug";
import { NamedPrimitiveStruct } from "../structs/NamedPrimitiveObject";

export const console = () =>
  NamedPrimitiveStruct("console", globalThis.console);

export const logTo = (console: Console, ...body: any[]) => {
  console.log(...body);
};
logTo.options = {
  slug() {
    return slug.uncacheable`logTo(...)`;
  },
};

const w1 = work(console);
const w2 = work(asValue, w1);

export const log = (...body: any[]) =>
  work(logTo, work(asValue, work(console)), ...body);
log.options = {
  slug() {
    return slug.uncacheable`log(...)`;
  },
};
