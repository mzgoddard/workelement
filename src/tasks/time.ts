import {
  Job,
  JobDerivableInputItem,
  JobInputOption,
  announceChanges,
  run,
  task,
} from "../core/run";
import { promise } from "./util";
import { DateObject, getDate, beginningOfTime } from "../structs/DateObject";
import { AbortSignalStruct } from "../structs/AbortSignalObject";
import { Sluggable, slug } from "../core/slug";
import { ReferenceObject } from "../core/ref";

export const ifNewer = task(
  (first: DateObject, second: DateObject, deferred: Job, otherwise?: Job) =>
    getDate(first) >= getDate(second) ? deferred : otherwise ?? {},
  {
    name: "ifNewer",
    deriveInput: ([first, second, deferred, otherwise]) =>
      Promise.all([run(first), run(second), deferred, otherwise]),
  }
) as <J1 extends Job, J2 extends Job | undefined>(
  first: JobDerivableInputItem<DateObject>,
  second: JobDerivableInputItem<DateObject>,
  deferred: J1,
  otherwise?: J2
) => Job<
  (J1 extends Job<infer T1> ? T1 : never) | (J2 extends Job<infer T2> ? T2 : {})
>;

export const mostRecent = task(
  (dates: DateObject[]) =>
    dates.reduce(
      (carry, item) => (getDate(carry) > getDate(item) ? carry : item),
      beginningOfTime()
    ),
  { name: "mostRecent" }
);

// const i = await run(ifNewer(DateStruct('1970/0', new Date(1970, 0)), DateStruct('1971/0', new Date(1971, 0)), promise(Promise.resolve({id: 1}))))

export const timeout = (name: string, milliseconds: number) => {
  const signal = AbortSignal.timeout(milliseconds);
  return AbortSignalStruct(name, signal);
};
timeout.options = {
  slug([name, milliseconds]: [
    name: JobInputOption<string>,
    milliseconds: JobInputOption<number>
  ]) {
    return slug.uncacheable`timeout(${name})`;
  },
};

export const delay = async (milliseconds: number, abortSignal?: AbortSignal) =>
  await new Promise((resolve, reject) => {
    setTimeout(resolve, milliseconds);
    if (abortSignal) {
      abortSignal.addEventListener("abort", reject);
    }
  });
delay.options = {
  slug([milliseconds, abortSignal]: [
    milliseconds: JobInputOption<number>,
    abortSignal?: JobInputOption<AbortSignal>
  ]) {
    return slug.uncacheable`delay(${milliseconds})`;
  },
};
