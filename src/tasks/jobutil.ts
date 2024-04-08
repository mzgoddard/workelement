import {
  Job,
  JobDerivableInput,
  JobDerivableInputItem,
  JobFactory,
  JobOutput,
  run,
  task,
  DerivedJob,
  JobDerivable,
  addDependencies,
  announceChanges,
} from "../core/jobcall";
import {
  MaySlug,
  SLUGIFY,
  SLUG_VALUE,
  Slug,
  SlugArray,
  isMaySlug,
  slug,
} from "../core/slug";
import { md5 } from "../support/md5";
import { abbreviate } from "../support/abbreviate";
import { SourceObject } from "../structs/SourceObject";
import { FunctionObject, isFunctionObject } from "../structs/FunctionObject";

export function source(content: string): SourceObject {
  return {
    content,
    [SLUGIFY]() {
      return slug`source(md5#${md5(content)})`;
    },
  };
}

export interface JSONData {
  data: any;
}

export const json = task(
  (input: SourceObject): JSONData => ({
    data: JSON.parse(input.content),
  }),
  { name: "fromJSON" }
);

let promiseIndex = 0;
const promiseSlugMap = new WeakMap<PromiseLike<any>, Slug>();
export const promise = task(
  <T>(input: PromiseLike<T>): PromiseLike<T> => input,
  {
    slug(input) {
      if (promiseSlugMap.has(input)) {
        return promiseSlugMap.get(input) as Slug;
      }
      const promiseSlug = slug`promise#${promiseIndex++}`;
      promiseSlugMap.set(input, promiseSlug);
      return promiseSlug;
    },
  }
) as Extract<<T>(input: PromiseLike<T>) => Job<JobOutput<T>>, JobFactory>;

export const all = task(
  async (input) => await run(Promise.all(input.map(run))),
  {
    name: "all",
    slug(input) {
      return slug`all([${
        isMaySlug(input)
          ? Slug(input)
          : abbreviate(
              slug(
                input.map((_, i) => (i > 0 ? "," : "")),
                ...input
              )[SLUG_VALUE]
            )
      }])`;
    },
  }
) as <T extends [] | any[]>(
  input: JobDerivableInputItem<JobDerivableInput<T>>
) => Job<JobOutput<T>>;

export const props = task(async (input) =>
  Object.fromEntries(
    await run(
      Promise.all(
        Object.entries(input).map(async ([key, value]) => [
          key,
          await run(value),
        ])
      )
    )
  )
) as <T extends {}>(
  input: T
) => Job<{
  [Key in keyof T]: T[Key] extends JobDerivable<infer Output> ? Output : T[Key];
}>;

export const get = task(
  <Fields, Key extends keyof Fields>(input: Fields, key: Key) => input[key],
  { slug: (input, key) => slug`get(${input},${key})` }
) as Extract<
  <Fields, Key extends keyof Fields>(
    input: JobDerivableInputItem<Fields>,
    key: Key
  ) => Job<Fields[Key]>,
  JobFactory
>;

export const func = <F extends (...args: any[]) => any>(
  name: string,
  func: F
): FunctionObject<F> => {
  return {
    name,
    func,
    [SLUGIFY]() {
      return slug`func#${name}#md5#${md5(func.toString())}`;
    },
  };
};

type TuplePrefix<T extends [] | any[]> = T extends [infer First, ...infer Rest]
  ? [] | [First] | [First, ...TuplePrefix<Extract<Rest, any[]>>]
  : T;

type Tail<T extends [] | any[]> = T extends [infer _, ...infer Rest] ? Rest : T;

type ExcludeTuplePrefix<
  T extends [] | any[],
  Prefix extends TuplePrefix<T>
> = Prefix extends []
  ? T
  : Prefix extends [infer _, ...infer Rest]
  ? ExcludeTuplePrefix<Tail<T>, Extract<Rest, TuplePrefix<Tail<T>>>>
  : T;

type Bound<
  F extends (...args: any[]) => any,
  Args extends TuplePrefix<Parameters<F>>
> = (...args: ExcludeTuplePrefix<Parameters<F>, Args>) => ReturnType<F>;

export const bind = <
  F extends (...args: any[]) => any,
  P extends TuplePrefix<Parameters<F>>
>(
  name: string,
  func: FunctionObject<F>,
  ...args: P
): FunctionObject<Bound<F, P>> => ({
  name,
  func: ((...lateArgs) => func.func(...args, ...lateArgs)) as F,
  [SLUGIFY]: () => slug`bound(${func}, ${SlugArray(args.map(Slug))})`,
});

export const call = task(
  <F extends (...args: any[]) => any>(op: FunctionObject<F>, ...args) =>
    op.func(...args),
  {
    name: "call",
  }
) as <F extends (...args: any[]) => any>(
  op: JobDerivableInputItem<FunctionObject<F> | F>,
  ...args: JobDerivableInput<Parameters<F>>
) => Job<JobOutput<ReturnType<F>>>;

export const onError = task((value, onerror: Job) => value, {
  name: "onError",
  deriveInput: async (derivableInput) => {
    // const onerror = await run(derivableInput[1]);
    const onerror = derivableInput[1];
    try {
      return [await run(derivableInput[0]), onerror];
    } catch (error) {
      // console.log('error', Slug(derivableInput[0]).__slug, Slug(onerror).__slug)
      const errorResult = await run(onerror);
      console.log(
        "error",
        Slug(derivableInput[0])[SLUG_VALUE],
        Slug(errorResult)[SLUG_VALUE]
      );
      if (isFunctionObject(errorResult)) {
        return [await run(errorResult.func(error)), onerror];
      }
      return [errorResult, onerror];
    }
  },
}) as <T1, T2>(
  value: JobDerivableInputItem<T1>,
  onerror:
    | Job<FunctionObject<(error: any) => T2>>
    | FunctionObject<(error: any) => T2>
    | Job<T2>
    | T2
) => Job<T1 | T2>;

type Last<T extends any[]> = T extends []
  ? never
  : T extends [infer _, infer Rest]
  ? Last<Extract<Rest, any[]>>
  : T extends (infer Item)[]
  ? Item
  : never;

export const after = task(
  async (...jobs: Job[]) => {
    let output;
    for (const jobItem of jobs) {
      output = await run(jobItem);
    }
    return output;
  },
  {
    name: "after",
    async deriveInput(jobs) {
      return jobs;
    },
  }
) as <Jobs extends [Job, ...Job[]] | Job[]>(
  ...jobs: Jobs
) => Job<DerivedJob<Last<Jobs>>>;

export const resolve = task((value: any) => value, { name: "resolve" }) as <T>(
  value: JobDerivableInputItem<T>
) => Job<T>;

export const reject = task(
  (error: any) => {
    throw error;
  },
  { name: "reject" }
) as (error: any) => Job<never>;

export const map = task(
  (items: any[], op: FunctionObject) => all(items.map(op.func)),
  {
    name: "map",
    async deriveInput([items, op]) {
      return await run(Promise.all([run(all(items as any[])), run(op)]));
    },
    slug(items, op) {
      return slug`map(${SlugArray(items)},${op})`;
    },
  }
) as <T1 extends any, T2 extends any>(
  items: JobDerivableInput<T1[]>,
  op: JobDerivableInputItem<
    FunctionObject<
      (value: T1, index: number, array: T1[]) => JobDerivableInputItem<T2>
    >
  >
) => Job<T2[]>;

export const changedBy = task(
  (value, inputs) => {
    addDependencies(inputs);
    return value;
  },
  {
    name: "changedBy",
    async deriveInput([value, inputs]) {
      return run(Promise.all([run(value), inputs]));
    },
  }
) as <T>(value: JobDerivableInputItem<T>, inputs: (MaySlug | Slug)[]) => Job<T>;

export const changes = task(
  (value, outputs) => {
    announceChanges(outputs);
    return value;
  },
  {
    name: "changes",
    async deriveInput([value, outputs]) {
      return run(Promise.all([run(value), outputs]));
    },
  }
) as <T>(
  value: JobDerivableInputItem<T>,
  outputs: (MaySlug | Slug)[]
) => Job<T>;
