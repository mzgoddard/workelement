import {
  MaySlug,
  SLUGIFY,
  Slug,
  SlugArray,
  SlugMap,
  SlugOutputStruct,
  Sluggable,
  isCacheable,
  isDependency,
  isMaySlug,
  slug,
  toSlug,
} from "./slug";
import { isPromise } from "util/types";
import { microtaskLock } from "../support/microtask-helper";
import { abbreviate } from "../support/abbreviate";
import {
  Result,
  ResultError,
  ResultOption,
  result,
  resultError,
} from "../support/Result";
import { DEREFERENCE, ReferenceObject } from "./ref";
import { VoidObject, VoidStruct } from "./VoidObject";
import { GET_DATE } from "../structs/DateObject";
import { deprecate } from "./deprecate";

export interface JobHandle<
  Input extends [] | Sluggable[] = any,
  DerivableOutput = any
> {
  (...input: Input): DerivableOutput;
}

export interface JobOptions<Input extends any[], DerivableOutput> {
  name?: string;
  slug?(...args: Input): Slug;
  deriveInput?(inputs: JobDerivableInput<Input>): Promise<Input>;
  deriveOutput?(
    output: DerivableOutput,
    slug: Slug
  ): Promise<JobOutput<DerivableOutput>>;
  slugerize?(output: DerivableOutput, slug: Slug): DerivableOutput & Sluggable;
}

type JobOptionsOf<Handle extends JobHandle> = Handle extends JobHandle<
  infer Input,
  infer DerivableOutput
>
  ? JobOptions<Input, DerivableOutput>
  : JobOptions<any, any>;

export interface JobFactoryInitializer<Handle extends JobHandle> {
  (handle: Handle, options?: JobOptionsOf<Handle>): JobFactoryOf<Handle>;
}

export interface JobFactory<
  DerivableInput extends [] | any[] = any[],
  Output = any
> {
  (...input: DerivableInput): Job<Output>;
}

export type RenderJobFactory<Factory extends JobFactory> =
  Factory extends JobFactory<infer DerivableInput, infer Output>
    ? (...input: DerivableInput) => Job<Output>
    : never;

type JobFactoryOf<Handle extends JobHandle> = Handle extends JobHandle<
  infer Input,
  infer DerivableOutput
>
  ? JobFactory<JobDerivableInput<Input>, JobOutput<DerivableOutput>>
  : never;

export interface Job<Output = any> extends MaySlug {
  __task?: any;
  __handle?: any;
  __input: any;
  __output?: Output;
}

export type JobDerivable<Output> = Job<Output> | PromiseLike<Output>;

/** Possible inputs to a JobFactory based on what JobHandle takes. */
export type JobDerivableInput<Input extends any[]> = Input extends []
  ? []
  : Input extends [infer First, ...infer Rest]
  ? [JobDerivableInputItem<First>, ...JobDerivableInput<Rest>]
  : Input extends (infer Item)[]
  ? JobDerivableInputItem<Item>[]
  : Input;
export type JobDerivableInputItem<InputItem> = Job<InputItem> | InputItem;

/** Result after JobHandle Output is processed. */
export type JobOutput<DerivableOutput> = DerivableOutput extends JobDerivable<
  infer Output
>
  ? JobOutput<Output>
  : DerivableOutput extends {}
  ? {
      [Key in keyof DerivableOutput]: JobOutputItem<DerivableOutput[Key]>;
    } & MaySlug
  : DerivableOutput extends []
  ? []
  : DerivableOutput extends [infer First, ...infer Rest]
  ? [JobOutputItem<First>, ...JobOutputItem<Rest>] & MaySlug
  : DerivableOutput extends (infer Item)[]
  ? JobOutputItem<Item>[] & MaySlug
  : DerivableOutput extends undefined | null
  ? Slug
  : DerivableOutput & Sluggable;
type JobOutputItem<DerivableOutputItem> =
  DerivableOutputItem extends JobDerivable<infer OutputItem>
    ? OutputItem
    : DerivableOutputItem;

export type DerivedJob<J extends Job> = J extends Job<infer Output>
  ? Output
  : never;

let optionsIndex = 0;

interface Task<
  Handle extends JobHandle<Input, DerivableOutput>,
  Input extends any[] = any[],
  DerivableOutput = any
> {
  handle: Handle;
  name: string;
  slug(...args: Input): Slug;
  deriveInput(inputs: JobDerivableInput<Input>): Promise<Input>;
  deriveOutput(
    output: DerivableOutput,
    slug: Slug
  ): Promise<JobOutput<DerivableOutput>>;
  slugerize(output: DerivableOutput, slug: Slug): DerivableOutput & Sluggable;
}
export const defaultSlug =
  (initializedName: string) =>
  (...args: JobDerivableInput<any>) =>
    slug`${initializedName}(${abbreviate(
      args
        .map(toSlug)
        .map((subslug) => subslug.__slug)
        .join(",")
    )})`;
export const defaultDeriveInput = async (
  derivableInput: JobDerivableInput<any>
) => await run(Promise.all(derivableInput.map(run)));

class TaskBase {}

function initTask<Handle extends JobHandle>(
  handle: Handle,
  options?: JobOptionsOf<Handle>
): Task<Handle> {
  const {
    name: maybeName,
    slug: maybeSlug,
    deriveInput: maybeDeriveInput,
    deriveOutput: maybeDeriveOutput,
    slugerize: maybeSlugerize,
  } = options ?? {};
  const taskIndex = optionsIndex++;
  const initializedName: JobOptionsOf<Handle>["name"] =
    maybeName ?? `nameless#${taskIndex}`;
  const initializedSlug: JobOptionsOf<Handle>["slug"] =
    maybeSlug ?? defaultSlug(initializedName);
  const initializedDeriveInput: JobOptionsOf<Handle>["deriveInput"] =
    maybeDeriveInput ?? defaultDeriveInput;
  const initializedDeriveOutput: JobOptionsOf<Handle>["deriveOutput"] =
    maybeDeriveOutput ??
    (async (output, slug) =>
      Object.fromEntries([
        ...(await run(
          Promise.all(
            Object.entries(await run(await run(output))).map(
              async ([key, value]) => [key, await run(await run(value))]
            )
          )
        )),
        [SLUGIFY, () => slug],
      ]));
  const initializedSlugerize: JobOptionsOf<Handle>["slugerize"] =
    maybeSlugerize ??
    ((output, slug) => {
      if (output && typeof output === "object" && !Array.isArray(output)) {
        return Object.create(output, {
          [SLUGIFY]: { value: () => SlugOutputStruct(slug) },
        });
      } else if (output === undefined || output === null) {
        return SlugOutputStruct(slug);
      }
      return output;
    });
  const className = `GeneratedTask${titleCase(initializedName)}`;
  const classNamer = {
    [className]: function () {} as any as abstract new (...args: any[]) => any,
  };
  classNamer[className].prototype = {
    name: initializedName,
    handle,
    slug: initializedSlug,
    deriveInput: initializedDeriveInput,
    deriveOutput: initializedDeriveOutput,
    slugerize: initializedSlugerize,
  };
  const namedConstructor = classNamer[className];
  return new { [className]: class extends namedConstructor {} }[className]();
}

function titleCase(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

const taskWorkWrapperMap = new Map();

function getWorkWrapper(
  handle: JobHandle,
  handleOptions?: JobOptionsOf<any>
): WorkDefinition {
  let task = taskWorkWrapperMap.get(handle);
  if (!task) {
    const name = handleOptions?.name ?? handle?.name ?? "nameless";
    task = { [name]: (...input) => handle(...input) }[name];
    let options;
    Object.defineProperty(task, "options", {
      get() {
        if (!options) {
          const deriveInput = handleOptions?.deriveInput ?? defaultDeriveInput;
          const slug = handleOptions?.slug ?? defaultSlug(name);
          options = {
            name,
            middleware: (handle) => async (inputs, slug) =>
              overwriteSlug(
                await run(handle(...(await run(deriveInput(inputs))))),
                slug
              ),
            slug: (args) => slug(...args),
          } as SimpleJobOptions<any, any, any>;
          deprecate(
            `taskWrapper(${options.name})`,
            (key) => `${key}: task(...) is deprecated.`
          );
        }
        return options;
      },
    });
    taskWorkWrapperMap.set(handle, task);
  }
  return task;
}

interface RenderedJobFactory {
  simpleTask: WorkDefinition;
}

/** @deprecated */
export function task<Handle extends JobHandle>(
  handle: Handle,
  options?: JobOptionsOf<Handle>
): RenderJobFactory<JobFactoryOf<Handle>> {
  deprecate(
    `task(${String(options?.name ?? handle.name)})`,
    (key) => `${key}: task(...) is deprecated.`
  );
  return Object.defineProperties(
    ((...input) => work(getWorkWrapper(handle, options), ...input)) as any,
    {
      simpleTask: {
        get() {
          return getWorkWrapper(handle, options);
        },
      },
    }
  );
}

export type PromiseOption<T> = Promise<T> | T;

export type JobOption<T = any> = Job<T> | T;

export type PromiseJobOption<T> = PromiseOption<JobOption<T>>;

export type JobReferenceOption<T> = ReferenceObject<T> | T;

export type JobInputOption<T extends Sluggable> =
  | Job<ReferenceObject<T>>
  | Job<T>
  | ReferenceObject<T>
  | T;

export type JobHandleOption<T> = Job<T> | T;

export type SimpleJobHandleInput<Input extends [] | any[]> = Input extends [
  infer First,
  ...infer Rest
]
  ? [JobInputOption<First>, ...SimpleJobHandleInput<Rest>]
  : Input;

export type WorkHandle<Input extends [] | any[] = any, Output = any> = (
  ...args: Input
) => Output;

export type SimpleJobHandleParameters<T extends WorkHandle> =
  T extends WorkHandle<infer Input, any> ? Input : never;
export type SimpleJobHandleReturn<T extends WorkHandle> = T extends WorkHandle<
  any,
  infer Output
>
  ? Output
  : never;

export type SimpleJobBeforeParameters<Input extends [] | any[]> =
  Input extends []
    ? []
    : Input extends [infer First, ...infer Rest]
    ? [JobInputOption<First>, ...SimpleJobBeforeParameters<Rest>]
    : Input extends (infer Item)[]
    ? JobInputOption<Item>[]
    : Input;

export type SimpleJobAfterReturn<T extends WorkHandle> = T extends WorkHandle<
  any,
  infer Output
>
  ? PromiseJobOption<Output>
  : never;

export type SimpleJobOptions<T extends WorkHandle, Input, Output> = {
  name?: string;
  before?(args: Input): PromiseJobOption<SimpleJobHandleParameters<T>>;
  after?(
    output: SimpleJobHandleReturn<T>,
    args: SimpleJobHandleParameters<T>,
    slug: Slug
  ): Output;
  middleware?(handle: T): (args: Input, slug: Slug) => Output;
  slug?(args: Input): Slug;
};

type PP<T> = { before?(): T };
type PA = {} extends PP<infer T> ? T : never;
type PB = { before(): number } extends PP<infer T> ? T : never;

const jjj = (num: string) => Number(num);
jjj.options = {
  before(args) {
    return args;
  },
  after(output) {
    return output;
  },
} as SimpleJobOptions<typeof jjj, any, any>;

export type WorkDefinition<
  T extends WorkHandle = any,
  Input = any,
  Output = any
> = T & { options?: SimpleJobOptions<T, Input, Output> };

export type SimpleJobDefinitionInput<
  Definition extends WorkDefinition<any, any, any>
> = Definition extends WorkDefinition<any, infer Input, any> ? Input : never;

export type JobAwaited<T extends PromiseJobOption<any>> =
  T extends PromiseJobOption<infer Output> ? Output : never;

export type SimpleJobDefinitionOutput<
  Definition extends WorkDefinition<any, any, any>
> = Definition extends WorkDefinition<any, any, infer Output> ? Output : never;

export type SimpleJobParameters<
  Definition extends WorkDefinition<any, any, any>
> = Definition extends { options: undefined }
  ? Definition extends WorkHandle<infer HandleInput, any>
    ? SimpleJobBeforeParameters<HandleInput>
    : unknown[]
  : Definition extends {
      options?: SimpleJobOptions<any, infer BeforeInput, any>;
    }
  ? unknown extends BeforeInput
    ? Definition extends WorkHandle<infer HandleInput, any>
      ? SimpleJobBeforeParameters<HandleInput>
      : unknown[]
    : BeforeInput
  : unknown[];

export type SimpleJobReturn<Definition extends WorkDefinition> =
  Definition extends {
    options?: SimpleJobOptions<any, any, infer AfterOutput>;
  }
    ? unknown extends AfterOutput
      ? Definition extends WorkHandle<any, PromiseJobOption<infer HandleOutput>>
        ? HandleOutput
        : unknown
      : AfterOutput
    : unknown;

export type SimpleJob<Definition extends WorkDefinition<any, any, any>> =
  Definition extends WorkDefinition<
    WorkHandle<any, PromiseJobOption<infer HandleOutput>>,
    any,
    PromiseOption<infer AfterOutput>
  >
    ? unknown extends AfterOutput
      ? HandleOutput extends void
        ? Job<VoidObject>
        : HandleOutput extends Sluggable
        ? Job<HandleOutput>
        : Job<HandleOutput & Sluggable>
      : Job<AfterOutput>
    : Job<unknown>;

export type JobParameters<Handle extends WorkHandle> = {};

export type JobReturnType<Handle extends WorkHandle> = {};

const tasks = new Map<WorkDefinition, SimpleTask<any>>();

export interface SimpleTask<Handle extends WorkDefinition> {
  name: string;
  run(
    inputs: SimpleJobParameters<Handle>,
    slug: Slug
  ): Promise<DerivedJob<SimpleJob<Handle>>>;
  slug(inputs: SimpleJobParameters<Handle>): Slug;
}

const overwriteObjectSlug = <T extends {} | [] | any[]>(
  obj: T,
  slug: Slug
): T & MaySlug => {
  return Object.create(obj, {
    [SLUGIFY]: { value: () => slug },
  });
};

const overwriteSlug = <T>(
  obj: T,
  slug: Slug
): T extends void | undefined
  ? VoidObject
  : T extends {} | [] | any[]
  ? T & MaySlug
  : T & Sluggable => {
  if (obj && typeof obj === "object") {
    return overwriteObjectSlug(obj, slug) as any;
  } else if (obj === undefined) {
    return overwriteObjectSlug(VoidStruct(), slug) as any;
  }
  return obj as any;
};

const EMPTY_OBJECT = {};

export const defaultMiddleware =
  <Handle, Input>(handle: Handle) =>
  async (args: Input, slug) => {
    return overwriteSlug(
      await run(
        await run((handle as any)(...(await runAllInputs(args as any))))
      ),
      slug
    );
  };

function initSimpleTask<Handle extends WorkDefinition<any, any, any>>(
  handle: Handle
): SimpleTask<Handle> {
  const {
    name = (handle as Function).name ?? "nameless",
    middleware = defaultMiddleware,
    slug: _slug = (args) => slug`${name}(${SlugArray(args)})`,
  } = (handle as WorkDefinition).options ?? EMPTY_OBJECT;
  return {
    name,
    run: middleware(handle),
    slug: _slug,
  };
}

function getTask<Handle extends WorkDefinition>(
  handle: Handle
): SimpleTask<Handle> {
  let task = tasks.get(handle);
  if (!task) {
    task = initSimpleTask(handle);
    tasks.set(handle, task);
  }
  return task;
}

class WorkElement<Handle extends WorkDefinition>
  implements Job<SimpleJobReturn<Handle>>
{
  __handle: Handle;
  __input: SimpleJobParameters<Handle>;
  constructor(handle: Handle, input: SimpleJobParameters<Handle>) {
    this.__handle = handle;
    this.__input = input;
  }
  [SLUGIFY]() {
    return getTask(this.__handle).slug(this.__input);
  }
}

function isJobFactory(maybe: unknown): maybe is RenderedJobFactory {
  return Boolean(maybe && (maybe as RenderedJobFactory).simpleTask);
}

type A1 = <T>(t: T) => T;
type A2<T extends (...args) => any, I extends (...args) => any> = ReturnType<
  T & I
>;
type A3 = ReturnType<A1 & (<T>(n: T & number) => T)>;
type A4 = Extract<A1, <T>(t: T) => T>;
type A5 = A4 & ((t: number) => number);
type A6<T> = T & number;
type A7 = A6<unknown>;
type A8 = ReturnType<(() => any) & ((t: number) => number)>;
type A9 = Parameters<(() => any) | ((t: number) => number)>;
type A10 = ReturnType<(() => unknown) | ((t: number) => number)>;
type A11<P, R> = (...args: P & ([] | any[])) => R;
type A12 = (<T>(t: T) => [T]) extends A11<infer P, infer R> ? [P, R] : never;
type A13 = ((t: number) => any) extends A11<infer T> ? T : never;
type A14<F, A, R> = F & ((...args: A & ([] | any[])) => R);
type A15<F, P, R> = (
  fn: F & ((...args: P & ([] | any[])) => R),
  ...args: P & ([] | any[])
) => R;
// type A16 = (fn: <T>(t: T) => [T], ...args: [number]) => ;
type A17<A, R> = (
  fn: (...args: A & ([] | any[])) => R,
  ...args: A & ([] | any[])
) => R;
type A18 = ((fn: <T>(t: T) => [T], ...args: [number]) => any) extends A17<
  infer A,
  infer R
>
  ? R
  : never;
type A19<A, R> = (...args: A & ([] | any[])) => R;
type A20<F, A> = ReturnType<F & ((...args: A & ([] | any[])) => unknown)>;
type A21 = A20<<T>(t: T) => [T], [t: number]>;

const f = <A, R>(
  fn: (...args: A & ([] | any[])) => R,
  ...args: A & ([] | any[])
): R => {};
const f1 = f(<T>(n: T) => [n] as [T], 1);

type WorkParameters<A> = A extends [infer First, ...infer Rest]
  ? [JobInputOption<First>, ...WorkParameters<Rest>]
  : A extends []
  ? []
  : A extends (infer Item)[]
  ? JobInputOption<Item>[]
  : never;

function g<A, R>(
  fn: (...args: A & ([] | any[])) => R,
  ...args: (A extends infer AA & ([] | any[]) ? WorkParameters<AA> : A) &
    ([] | any[])
): { result: R };
// function g<F, A, R>(
//   fn: F & ((...args: A & ([] | any[])) => R),
//   ...args: A extends [infer A0] ? [JobInputOption<A0>] : never
// ): { result: R };
// function g<F, A, R>(
//   fn: F & ((...args: A & ([] | any[])) => R),
//   ...args: A & []
// ): { result: R };
function g<A, R>(
  fn: (...args: A & ([] | any[])) => R,
  ...args: A & ([] | any[])
): { result: R };
function g(fn: any, ...args: any): { result: unknown };
function g(fn: any, ...args: any): any {}
const g1 = g(<T>([t]: [T]): { t: T } => ({ t }), [1]);

type AnyParams = [] | any[];

type HandleParameters<A> = A extends [
  JobInputOption<infer First>,
  ...infer Rest
]
  ? [First, ...HandleParameters<Rest>]
  : A extends []
  ? []
  : never;

type Clean<T> = T;
type MiddlewareParameters<A> = A extends [infer First, ...infer Rest]
  ? [First, ...MiddlewareParameters<Rest>]
  : A extends []
  ? []
  : A extends (infer Item)[]
  ? Item[]
  : never;
export type MiddlewareReturn<M> = M extends (
  handle: (...args) => any
) => (args: any, slug: Slug) => infer R
  ? R
  : never;

type WorkMiddlewareOptions<A, R> = {
  options: {
    middleware: (
      handle: (...args: any) => any
    ) => (args: A & ([] | any[]), ...rest: any) => R;
  };
};

function p1<A extends [] | any[], R>(...args: A): R {}
type P1<F> = ReturnType<F & typeof p1>;
type P2 = P1<<T>(t: T) => [T]>;
type P3<A, R> = typeof p1<A & ([] | any[]), R>;
type P4 = P3<[], number>;
type P5 = typeof p1 & (<T>(t: T) => [T]);
type P6 = ReturnType<P5 & ((t: number) => unknown)>;

// export function work<M, A, P, R, O = "middleware">(
//   handle: M &
//     ((...args: any) => any) & {
//       options: {
//         middleware: (
//           handle: (...args: any) => any
//         ) => (args: A & ([] | any[]), ...rest: any) => R;
//       };
//     },
//   ...args: P & MiddlewareParameters<A & ([] | any[])>
// ): M & {
//   options: {
//     middleware: (
//       handle: (...args: any) => any
//     ) => (...args: A & MiddlewareParameters<P & ([] | any[])>) => R;
//   };
// } extends WorkMiddlewareOptions<any, infer R2>
//   ? Job<R2>
//   : Job<unknown>;

// export function work<F, A, R>(handle: {work: F & ((fn: any, args: A & ([] | any[])) => R)})

// export function work<F, A0, A1, A2, A3, P, R, O = "raw [4]">(
//   handle: F &
//     ((slug: Slug, args: [A0, A1, A2, A3] & Extract<P, [] | any[]>) => R),
//   ...args: P & [A0, A1, A2, A3]
// ): Job<Awaited<R>>;
// export function work<F, A0, A1, A2, P, R, O = "raw [3]">(
//   handle: F & ((slug: Slug, args: [A0, A1, A2] & Extract<P, [] | any[]>) => R),
//   ...args: P & [A0, A1, A2]
// ): Job<Awaited<R>>;
// export function work<F, A0, A1, P, R, O = "raw [2]">(
//   handle: F & ((slug: Slug, args: [A0, A1] & Extract<P, [] | any[]>) => R),
//   ...args: P & [A0, A1]
// ): Job<Awaited<R>>;
// export function work<F, A0, P, R, O = "raw [1]">(
//   handle: F & ((slug: Slug, args: [A0] & Extract<P, [A0]>) => R),
//   ...args: P & [A0]
// ): Job<Awaited<R>>;
// export function work<F, P, R, O = "raw [0]">(
//   handle: F & ((slug: Slug, args: []) => R),
//   ...args: []
// ): Job<Awaited<R>>;

// export function work<
//   F extends (slug: Slug, args: A) => any,
//   G,
//   A,
//   P extends A,
//   R1,
//   R,
//   O = "raw"
// >(
//   handle1: F | (F & ((slug: Slug, args: MiddlewareParameters<P>) => R)),
//   handle2: any,
//   args: (P & ([] | any[])) | A
// ): Job<Awaited<R>>;
// export function work<F, A, P, R, O = "params">(
//   handle: F & ((slug: Slug, args: A & ([] | any[])) => R),
//   args: MiddlewareParameters<A>
// ): Job<Awaited<R>>;

// export function work<A, R, O = 1>(
//   handle: ((...args: any) => any) & {
//     options: {
//       middleware: (handle: (...args: any) => any) => (args: A, slug: Slug) => R;
//     };
//   },
//   ...args: A & AnyParams
// ): R extends PromiseOption<infer R2> ? Job<R2> : Job<unknown>;
// export function work<F, A, R, O = "no middleware [1]">(
//   handle: F & ((...args: A & ([] | any[])) => R),
//   ...args: Parameters<F & ((...args: A & ([] | any[])) => R)> extends [infer A0]
//     ? [JobInputOption<A0>]
//     : never
// ): R extends PromiseJobOption<infer R2> ? Job<R2> : Job<unknown>;
// export function work<F, A, R, O = "no middleware [...]">(
//   handle: F & ((...args: A & ([]) => R),
//   ...args: Parameters<F & ((...args: A & AnyParams) => R)>
// ): R extends PromiseJobOption<infer R2>
//   ? R2 extends void
//     ? Job<VoidObject>
//     : Job<R2 & Sluggable>
//   : Job<unknown>;

export function work<F, A, P, R1, R, O = "no middleware [...]">(
  handle: F & ((...args: A & ([] | any[])) => R),
  ...args: P & WorkParameters<A & ([] | any[])>
): ReturnType<
  F & ((...args: A & HandleParameters<P>) => R)
> extends PromiseJobOption<infer R2>
  ? R2 extends void
    ? Job<VoidObject>
    : R2 extends MaySlug
    ? Job<R2>
    : Job<R2 & Sluggable>
  : Job<unknown>;

// export function work<F, A, R>(
//   handle: F & ((...args: A & ([] | any[])) => R),
//   ...args: (A extends infer AA & ([] | any[]) ? AA : A) & ([] | any[])
// ): R extends PromiseJobOption<infer R2> ? Job<R2> : Job<unknown>;
// export function work<F, A, R>(
//   handle: F & ((...args: A & ([] | any[])) => R),
//   ...args: (A extends [] ? [] : never) & ([] | any[])
// ): R extends PromiseJobOption<infer R2> ? Job<R2> : Job<unknown>;
// export function work<Handle extends WorkDefinition>(
//   handle: Handle,
//   ...args: SimpleJobParameters<Handle>
// ): SimpleJob<Handle>;
// export function work<T extends (...args: any[]) => any>(
// handle: T,
// ...args: Parameters<T>
// ): ReturnType<T> extends PromiseOption<infer T2> ? Job<T2> : Job<unknown>;
export function work(handle: any, ...args: any[]): Job<any> {
  if (isJobFactory(handle)) {
    deprecate(
      `work(task(${handle.simpleTask.options.name}))`,
      (key) => `${key}: work(task(...), ...) is deprecated.`
    );
    return new WorkElement(handle.simpleTask, args) as SimpleJob<any>;
  }
  return new WorkElement(handle as WorkDefinition, args) as SimpleJob<any>;
}

export async function runInput<T>(input: JobInputOption<T>): Promise<T> {
  const result = await run(input);
  if (result[DEREFERENCE]) {
    return result[DEREFERENCE]();
  }
  return result as any;
}

export type AllInput<T extends [] | any[]> = T extends []
  ? []
  : T extends [JobInputOption<infer T>, ...infer Rest]
  ? [T, ...AllInput<Rest>]
  : T;

export async function runAllInputs<T extends [] | any[]>(
  input: T
): Promise<AllInput<T>> {
  return (await Promise.all(input.map(runInput))) as any;
}

type Work<T = any> = Promise<ResultOption<T>>;

interface RunContextCollection {
  job: any;
  slug: Slug;
  main: RunContext | null;
  iterations: Set<RunContext>;

  readonly globalIndex: number | null;
  readonly upToDate: boolean | null;
  readonly work: Work<any> | null;
  readonly dependencies: Set<any> | null;
  readonly guards: Set<any> | null;
}

interface RunContext {
  job: any;
  slug: Slug;
  collection: RunContextCollection;
  // index: number;
  globalIndex: number;
  upToDate: boolean;
  work: Work | null;
  copyOf: RunContext | null;
  copies: Set<RunContext> | null;
  dependencies: Set<RunContext> | undefined;
  // changes: Set<any>;
  guards: Set<Guard> | undefined;
  // resources: Set<ResourceFactory> | undefined;
  parent: RunContext | null;
  // mainIteration: RunIteration | null;
  // iterations: Set<RunIteration>;
}

let activeContext = null as RunContext;
let nextContextIndex = 0;

const contextMap = new SlugMap<RunContextCollection>();

const workMap = new SlugMap<Work>();

function isSimpleJob<T>(job: unknown): job is Job<T> {
  return Boolean(job && typeof job === "object" && (job as Job).__handle);
}

export async function run<J>(
  job: J
): Promise<
  J extends Job<infer Output>
    ? Output
    : J extends Promise<infer P>
    ? P extends Job<infer Output>
      ? Output
      : P
    : J
> {
  const parentContext = activeContext;
  try {
    if (isSimpleJob(job)) {
      const task = getTask(job.__handle);
      const slug = task.slug(job.__input);
      let contextCollection = findOrCreateContextCollection<J>(slug, job);
      let work = contextCollection.work;
      if (!work || !contextCollection.upToDate) {
        const jobContext: RunContext = createContext<J>(
          job,
          slug,
          contextCollection,
          parentContext
        );
        work = (async () => {
          try {
            await microtaskLock();
            activeContext = jobContext;
            return await task.run(job.__input, slug);
          } finally {
            if (jobContext.guards) {
              await Promise.all(
                Array.from(jobContext.guards.values(), (guardItem) => {
                  return guardItem.release();
                })
              );
            }
          }
        })().then(result, resultError);
        jobContext.work = work;
        if (isCacheable(slug)) {
          contextCollection.main = jobContext;
        }
      } else {
        createRepeatContext(job, slug, contextCollection, parentContext);
      }
      try {
        return (await work).unwrap();
      } finally {
        await microtaskLock();
        activeContext = parentContext;
      }
    }
    if (isJob(job)) {
      const task = job.__task as Task<any>;
      const slug = Slug(job);
      let contextCollection = findOrCreateContextCollection<J>(slug, job);
      let work = contextCollection.work;
      if (!work || !contextCollection.upToDate) {
        const jobContext: RunContext = createContext<J>(
          job,
          slug,
          contextCollection,
          parentContext
        );
        work = (async () => {
          try {
            await microtaskLock();
            activeContext = jobContext;
            const input = await task.deriveInput(job.__input);
            activeContext = jobContext;
            const output = await task.handle(...input);
            activeContext = jobContext;
            return task.slugerize(await run(output), slug);
          } finally {
            if (jobContext.guards) {
              await Promise.all(
                Array.from(jobContext.guards.values(), (guardItem) => {
                  return guardItem.release();
                })
              );
            }
          }
        })().then(result, resultError);
        jobContext.work = work;
        if (isCacheable(slug)) {
          contextCollection.main = jobContext;
        }
      } else {
        createRepeatContext(job, slug, contextCollection, parentContext);
      }
      return (await work).unwrap();
    }
    if (isPromise(job)) {
      const result = await job;
      await microtaskLock();
      activeContext = parentContext;
      return (await run(result)) as any;
    }
    if (parentContext && isMaySlug(job)) {
      const slug = Slug(job);
      if (isDependency(slug)) {
        const contextCollection = findOrCreateContextCollection(slug, job);
        const jobContext = createRepeatContext(
          job,
          slug,
          contextCollection,
          parentContext
        );
        if (isCacheable(slug)) {
          contextCollection.main = jobContext;
        }
      }
    }
    return job as any;
  } finally {
    await microtaskLock();
    activeContext = parentContext;
  }
}

export const getContext = (job: Sluggable) => contextMap.get(Slug(job));

export const getThisContext = () => activeContext;

export interface DependencyTree {
  slug: Slug;
  jobIndex: number;
  upToDate: boolean | undefined;
  dependencies: DependencyTree[];
}

export const getDependencyTree = (job: Job): DependencyTree => ({
  jobIndex: getContext(job)?.globalIndex ?? -1,
  slug: Slug(job),
  upToDate: getContext(job)?.upToDate ?? undefined,
  dependencies: Array.from(getContext(job)?.dependencies?.values() ?? [])
    .map((context) => context.slug)
    .map(getDependencyTree),
});

type JobPromiseFactory<T> = JobFactory<[Promise<T>], T>;

let nextGlobalIndex = 1;

function createRepeatContext<J>(
  job: J,
  slug: Slug,
  contextCollection: RunContextCollection,
  parentContext: RunContext
) {
  const copyOf = contextCollection.main;
  const jobContext: RunContext = {
    job,
    slug,
    collection: contextCollection,
    globalIndex: nextGlobalIndex++,
    upToDate: true,
    copyOf,
    copies: null,
    work: null as Promise<any>,
    dependencies: undefined,
    guards: undefined,
    parent: parentContext,
  };
  if (copyOf) {
    if (!copyOf.copies) {
      copyOf.copies = new Set();
    }
    copyOf.copies.add(jobContext);
  }
  contextCollection.iterations.add(jobContext);
  if (parentContext) {
    parentContext.dependencies?.add(jobContext);
  }
  return jobContext;
}

function createContext<J>(
  job: J,
  slug: Slug,
  contextCollection: RunContextCollection,
  parentContext: RunContext
) {
  const jobContext: RunContext = {
    job,
    slug,
    collection: contextCollection,
    globalIndex: nextGlobalIndex++,
    upToDate: true,
    copies: null,
    copyOf: null,
    work: null as Promise<any>,
    dependencies: new Set(),
    guards: undefined,
    parent: parentContext,
  };
  contextCollection.iterations.add(jobContext);
  if (parentContext) {
    parentContext.dependencies.add(jobContext);
  }
  return jobContext;
}

function findOrCreateContextCollection<J>(slug: Slug, job: J) {
  let contextCollection = contextMap.get(slug);
  if (!contextCollection) {
    contextCollection = {
      job,
      slug,
      main: null as RunContext,
      iterations: new Set(),
      get globalIndex() {
        return this.main?.globalIndex ?? -1;
      },
      get upToDate() {
        return this.main?.upToDate ?? null;
      },
      get work() {
        return this.main?.work ?? null;
      },
      get dependencies() {
        return this.main?.dependencies ?? null;
      },
      get guards() {
        return this.main?.guards ?? null;
      },
    };
    contextMap.set(slug, contextCollection);
  }
  return contextCollection;
}

function isJob(value: unknown): value is Job {
  return Boolean(value && (value as Job).__task);
}

export interface Guard {
  release(): Promise<void>;
}

export const guardScope = task(
  (job: Job) => {
    getThisContext().guards = new Set();
    return job;
  },
  {
    name: "guardScope",
    async deriveInput(inputs) {
      return inputs;
    },
  }
);

export const addGuard = (guard: Guard) => {
  let context = getThisContext();
  while (context && !context.guards) {
    context = context.parent;
  }
  if (!context) {
    context = getThisContext();
    context.guards = new Set();
  }
  context.guards.add(guard);
};

export type ResourceFactory<T> = JobFactory<[], T>;

export const initResource = task(
  <T>(resource: ResourceFactory<T>, value: T) => value,
  {
    name: "initResource",
    slug(resource, value) {
      return Slug(resource);
    },
  }
) as <T>(
  resource: JobDerivableInputItem<ResourceFactory<T>>,
  value: JobDerivableInputItem<T>
) => Job<T>;

export const walkContextLeaves = function* (
  context: RunContext
): IterableIterator<RunContext> {
  for (const dep of context.dependencies) {
    if (!isCacheable(dep.slug)) {
      continue;
    }
    if (dep.dependencies?.size > 0) {
      yield* walkContextLeaves(dep);
    } else {
      yield dep;
    }
  }
};

export const addDependencies = (dependencies: (MaySlug | Slug)[]) => {
  const contexts = dependencies.map((dep) => {
    const slug = Slug(dep);
    return findOrCreateContextCollection(slug, dep);
  });
  for (const leaf of walkContextLeaves(getThisContext())) {
    for (const dep of contexts) {
      createRepeatContext(dep.job, dep.slug, dep, leaf);
    }
  }
};

export const walkContextParents = function* (
  context: RunContextCollection
): IterableIterator<RunContextCollection> {
  yield context;
  for (const iteration of context.iterations) {
    if (iteration.parent) {
      yield* walkContextParents(iteration.parent.collection);
    }
  }
};

export const announceChanges = (changes: (MaySlug | Slug)[]) => {
  for (const change of changes) {
    for (const context of walkContextParents(getContext(change))) {
      for (const iteration of context.iterations) {
        iteration.upToDate = false;
      }
    }
  }
};
