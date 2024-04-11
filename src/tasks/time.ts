import {
  Work,
  JobDerivableInputItem,
  JobInputOption,
  announceChanges,
  run,
  task,
  JobOption,
  runInput,
  work,
  MiddlewareReturn,
  Job,
} from "../core/run";
import { promise } from "./util";
import {
  DateObject,
  getDate,
  beginningOfTime,
  GET_DATE,
} from "../structs/DateObject";
import { AbortSignalStruct } from "../structs/AbortSignalObject";
import { MaySlug, Slug, Sluggable, slug } from "../core/slug";
import { ReferenceObject, asValue } from "../core/ref";
import { inspect } from "node:util";
import { VoidObject, VoidStruct } from "../core/VoidObject";
import { PrimitiveStruct } from "../structs/PrimitiveObject";

export const ifNewer = task(
  (first: DateObject, second: DateObject, deferred: Work, otherwise?: Work) =>
    getDate(first) >= getDate(second) ? deferred : otherwise,
  {
    name: "ifNewer",
    deriveInput: ([first, second, deferred, otherwise]) =>
      Promise.all([run(first), run(second), deferred, otherwise]),
  }
) as <J1 extends Work, J2 extends Work | undefined>(
  first: JobDerivableInputItem<DateObject>,
  second: JobDerivableInputItem<DateObject>,
  deferred: J1,
  otherwise?: J2
) => Work<
  | (J1 extends Work<infer T1> ? T1 : never)
  | (J2 extends Work<infer T2> ? T2 : {})
>;

const _ifNewerPlus = async <T1, T2>(
  slug: Slug,
  [first, second, deferred, otherwise]: [
    first: DateObject,
    second: DateObject,
    deferred: JobInputOption<T1>,
    otherwise?: JobInputOption<T2>
  ]
): Promise<(T1 | (unknown extends T2 ? VoidObject : T2)) & Sluggable> =>
  getDate(first) > getDate(second) ? deferred : otherwise ?? VoidStruct();
_ifNewerPlus.meta = { raw: true };
// ifNewer2.options = {
//   raw: true,
//   work: work as <T1, T2>(
//     fn: typeof ifNewer2,

//     first: DateObject,
//     second: DateObject,
//     deferred: JobInputOption<T1>,
//     otherwise?: JobInputOption<T2>
//   ) => Job<(T1 | (unknown extends T2 ? VoidObject : T2)) & Sluggable>,
//   middleware:
//     (
//       handle: <T1, T2>(
//         first: DateObject,
//         second: DateObject,
//         deferred: JobOption<T1>,
//         otherwise?: JobOption<T2>
//       ) => JobOption<T1> | (unknown extends T2 ? VoidObject : JobOption<T2>)
//     ) =>
//     async <T1, T2>(
//       args: [
//         first: JobInputOption<DateObject>,
//         second: JobInputOption<DateObject>,
//         deferred: JobInputOption<T1>,
//         otherwise?: JobInputOption<T2>
//       ],
//       slug: Slug
//     ): Promise<(T1 | (unknown extends T2 ? VoidObject : T2)) & Sluggable> =>
//       overwriteSlug(
//         await run(
//           handle(
//             ...(await run(
//               Promise.all([
//                 runInput(first),
//                 runInput(second),
//                 deferred,
//                 otherwise,
//               ])
//             ))
//           )
//         ),
//         slug
//       ),
// };

export const ifNewerPlus = <T1, T2>(
  first: JobInputOption<DateObject>,
  second: JobInputOption<DateObject>,
  deferred: JobInputOption<T1>,
  otherwise?: JobInputOption<T2>
): T1 | (unknown extends T2 ? VoidObject : T2) extends infer R
  ? R extends MaySlug
    ? Job<R>
    : Job<R & Sluggable>
  : Job<unknown> => {
  return work(_ifNewerPlus, first, second, deferred, otherwise) as Job;
};

export const mostRecent = task(
  (dates: DateObject[]) =>
    // console.log(...dates),
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

export const delay = async (
  milliseconds: number,
  abortSignal?: AbortSignal
): Promise<void> =>
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

function ww<F, A, P, R>(
  f: {
    options: { work: F & ((fn: any, ...args: A & ([] | any[])) => R) };
  },
  ...args: A & ([] | any[])
) {
  return f.options.work(f, ...args);
}

const w1 = ww(_ifNewerPlus, beginningOfTime(), beginningOfTime(), 1, 2);
const out = run(w1);
const w2 = _ifNewerPlus.options.work(
  _ifNewerPlus,
  beginningOfTime(),
  beginningOfTime(),
  1,
  2
);

// function ww<F>(f: F & ((...args: any) => any)): <G extends F, P extends A, R>(args: P & ([] | any[])) => ReturnType<G & ((...args: P & ([] | any[])) => R)> {}

// const wwn = ww(ifNewer2);
// const w1 = wwn([beginningOfTime(), beginningOfTime(), 1, 2])

const d1 = work(delay, 100);
const d2 = work(delay, work(asValue, PrimitiveStruct(100)));
const d3 = work(delay);

const in1 = work(_ifNewerPlus, beginningOfTime(), beginningOfTime(), 1);
const in2 = work(_ifNewerPlus, beginningOfTime(), beginningOfTime(), 1, true);
const in3 = ifNewerPlus(beginningOfTime(), work(beginningOfTime), 1);
const in3out = run(in3);
const in33 = work(_ifNewerPlus);
const in4 = work(
  _ifNewerPlus,
  beginningOfTime(),
  beginningOfTime(),
  PrimitiveStruct(1)
);
const in5 = work(
  asValue,
  work(
    _ifNewerPlus,
    beginningOfTime(),
    beginningOfTime(),
    PrimitiveStruct(1),
    PrimitiveStruct(2)
  )
);
type IN1 = MiddlewareReturn<(typeof _ifNewerPlus)["options"]["middleware"]>;
