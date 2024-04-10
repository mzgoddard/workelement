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
  // __output: Output;
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
        // return { ...output, toSlug: () => SlugOutputStruct(slug) };
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
  // return new classNamer[className]();
  return new {
    [className]: class {
      get name() {
        return initializedName;
      }
      get handle() {
        return handle;
      }
      get slug() {
        return initializedSlug;
      }
      get deriveInput() {
        return initializedDeriveInput;
      }
      get deriveOutput() {
        return initializedDeriveOutput;
      }
      get slugerize() {
        return initializedSlugerize;
      }
    },
  }[className]();
  return {
    name: initializedName,
    handle,
    slug: initializedSlug,
    deriveInput: initializedDeriveInput,
    deriveOutput: initializedDeriveOutput,
    slugerize: initializedSlugerize,
  } as any;
}

function titleCase(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

const taskWorkWrapperMap = new Map();

function getWorkWrapper(
  handle: JobHandle,
  handleOptions?: JobOptionsOf<any>
): SimpleJobDefinition {
  let task = taskWorkWrapperMap.get(handle);
  if (!task) {
    // console.log("new task", handleOptions?.name ?? handle?.name ?? "nameless");
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
  // console.log(
  //   "get task wrapper",
  //   handleOptions?.name ?? handle?.name ?? "nameless",
  //   task.options.name
  // );
  return task;
}

interface RenderedJobFactory {
  simpleTask: SimpleJobDefinition;
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
  // const task = initTask(handle, options);
  // return Object.assign((...input) => ({
  //   // __task: task,
  //   __handle:
  //   __input: input,
  //   [SLUGIFY]() {
  //     return task.slug(...input);
  //   },
  // }));
}

// type TT<
//   Handle = (...args) => any,
//   Options extends {
//     handle: Handle;
//     prepare?: (args: Parameters<Extract<Handle, (...args) => any>>) => any;
//   } = { handle: Handle }
// > = Options;

// const castTT = <T extends TT>(tt: T): T => tt;

// const tt = castTT({
//   handle: (num: string) => Number(num),
//   prepare: (args) => args,
// });

// type TTOptions<Handle extends (...args) => any> = {
//   prepare?: (args: Parameters<Handle>) => [] | any[]
// }

// const tttOptions = <Handle extends (...args) => any>(handle: Handle, options: TTOptions<Handle>) => options;

// const ttt = (num: string) => Number(num);
// ttt.options = tttOptions(ttt, {prepare: args => args});

// const extendTask = <Handle>(handle: Handle, options: {}) {}

export type PromiseOption<T> = Promise<T> | T;

export type JobOption<T> = Job<T> | T;

export type JobReferenceOption<T> = ReferenceObject<T> | T;

export type JobInputOption<T = any> = JobOption<JobReferenceOption<T>> &
  Sluggable;

export type JobHandleOption<T> = Job<T> | T;

// export type SimpleJobHandleInputItem<Item> = ;

export type SimpleJobHandleInput<Input extends [] | any[]> = Input extends [
  infer First,
  ...infer Rest
]
  ? [JobInputOption<First>, ...SimpleJobHandleInput<Rest>]
  : Input;

export type SimpleJobHandle<Input extends [] | any[] = any, Output = any> = (
  ...args: Input
) => Output;

export type SimpleJobHandleParameters<T extends SimpleJobHandle> =
  T extends SimpleJobHandle<infer Input, any> ? Input : never;
export type SimpleJobHandleReturn<T extends SimpleJobHandle> =
  T extends SimpleJobHandle<any, infer Output> ? Output : never;

export type SimpleJobBeforeParameters<Input extends [] | any[]> =
  Input extends []
    ? []
    : Input extends [infer First, ...infer Rest]
    ? [JobInputOption<First>, ...SimpleJobBeforeParameters<Rest>]
    : Input extends (infer Item)[]
    ? JobInputOption<Item>[]
    : Input;

export type SimpleJobAfterReturn<T extends SimpleJobHandle> =
  T extends SimpleJobHandle<any, infer Output>
    ? PromiseOption<JobOption<Output>>
    : never;

export type SimpleJobOptions<T extends SimpleJobHandle, Input, Output> = {
  name?: string;
  before?(args: Input): PromiseOption<JobOption<SimpleJobHandleParameters<T>>>;
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

export type SimpleJobDefinition<
  T extends SimpleJobHandle = any,
  Input = any,
  Output = any
> = T & { options?: SimpleJobOptions<T, Input, Output> };

export type SimpleJobDefinitionInput<
  Definition extends SimpleJobDefinition<any, any, any>
> = Definition extends SimpleJobDefinition<any, infer Input, any>
  ? Input
  : never;

export type JobAwaited<T extends PromiseOption<JobOption<any>>> =
  T extends PromiseOption<JobOption<infer Output>> ? Output : never;

export type SimpleJobDefinitionOutput<
  Definition extends SimpleJobDefinition<any, any, any>
> = Definition extends SimpleJobDefinition<any, any, infer Output>
  ? Output
  : never;

export type SimpleJobParameters<
  Definition extends SimpleJobDefinition<any, any, any>
> = Definition extends { options: undefined }
  ? Definition extends SimpleJobHandle<infer HandleInput, any>
    ? SimpleJobBeforeParameters<HandleInput>
    : unknown[]
  : Definition extends {
      options?: SimpleJobOptions<any, infer BeforeInput, any>;
    }
  ? unknown extends BeforeInput
    ? Definition extends SimpleJobHandle<infer HandleInput, any>
      ? SimpleJobBeforeParameters<HandleInput>
      : unknown[]
    : BeforeInput
  : unknown[];

export type SimpleJobReturn<Definition extends SimpleJobDefinition> =
  Definition extends {
    options?: SimpleJobOptions<any, any, infer AfterOutput>;
  }
    ? unknown extends AfterOutput
      ? Definition extends SimpleJobHandle<
          any,
          PromiseOption<JobOption<infer HandleOutput>>
        >
        ? HandleOutput
        : unknown
      : AfterOutput
    : unknown;

export type SimpleJob<Definition extends SimpleJobDefinition<any, any, any>> =
  Definition extends SimpleJobDefinition<
    SimpleJobHandle<any, PromiseOption<JobOption<infer HandleOutput>>>,
    any,
    PromiseOption<infer AfterOutput>
  >
    ? unknown extends AfterOutput
      ? HandleOutput extends void
        ? Job<VoidObject>
        : Job<HandleOutput>
      : Job<AfterOutput>
    : Job<unknown>;

// export type SimpleJobHandle<Input = any, Output = any> = JobHandle & {
//   before?(): void;
// };

export type JobParameters<Handle extends SimpleJobHandle> = {};

export type JobReturnType<Handle extends SimpleJobHandle> = {};

const tasks = new Map<SimpleJobDefinition, SimpleTask<any>>();

// const jobConstructors = new Map<SimpleJobDefinition<any, any, any>>

export interface SimpleTask<Handle extends SimpleJobDefinition> {
  name: string;
  run(
    inputs: SimpleJobParameters<Handle>,
    slug: Slug
  ): Promise<DerivedJob<SimpleJob<Handle>>>;
  slug(inputs: SimpleJobParameters<Handle>): Slug;
}

type A1 = any extends {} ? 1 : true;
type A2 = {} extends any ? 1 : true;
type A3 = any extends any ? 1 : true;
type A4 = never extends {} ? 1 : true;
type A5 = {} extends never ? 1 : true;
type A6 = never extends never ? 1 : true;
type A7 = unknown extends {} ? 1 : true;
type A8 = {} extends unknown ? 1 : true;
type A9 = unknown extends unknown ? 1 : true;
type A10 = any extends unknown ? 1 : true;
type A11 = unknown extends any ? 1 : true;
type A12 = unknown extends never ? 1 : true;
type A13 = never extends unknown ? 1 : true;

type OnlyAny<T> = (any extends T ? true : false) extends true
  ? unknown extends T
    ? never
    : any
  : never;
type OA1 = OnlyAny<any>;
type OA4 = OnlyAny<unknown>;
type OA2 = OnlyAny<{}>;
type OA3 = OnlyAny<never>;

const overwriteObjectSlug = <T extends {} | [] | any[]>(
  obj: T,
  slug: Slug
): T & MaySlug => {
  // console.log(
  //   obj,
  //   obj[GET_DATE],
  //   Object.create(obj, {
  //     [SLUGIFY]: { value: () => slug },
  //   }),
  //   Object.create(obj, {
  //     [SLUGIFY]: { value: () => slug },
  //   })[GET_DATE]
  // );
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

function initSimpleTask<Handle extends SimpleJobDefinition<any, any, any>>(
  handle: Handle
): SimpleTask<Handle> {
  const {
    name = (handle as Function).name ?? "nameless",
    middleware = defaultMiddleware,
    slug: _slug = (args) => slug`${name}(${SlugArray(args)})`,
  } = (handle as SimpleJobDefinition).options ?? EMPTY_OBJECT;
  // const run =
  return {
    name,
    run: middleware(handle),
    slug: _slug,
  };
}

function getTask<Handle extends SimpleJobDefinition>(
  handle: Handle
): SimpleTask<Handle> {
  let task = tasks.get(handle);
  if (!task) {
    task = initSimpleTask(handle);
    tasks.set(handle, task);
  }
  // console.log(
  //   "get task",
  //   (handle as any)?.options?.name ?? (handle as any)?.name ?? "nameless",
  //   task.name
  // );
  return task;
}

class WorkElement<Handle extends SimpleJobDefinition>
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

export function work<Handle extends SimpleJobDefinition>(
  handle: Handle,
  ...args: SimpleJobParameters<Handle>
): SimpleJob<Handle>;
export function work<T extends (...args: any[]) => Job<any>>(
  handle: T,
  ...args: Parameters<T>
): ReturnType<T>;
export function work(handle: any, ...args: any[]): Job<any> {
  if (isJobFactory(handle)) {
    deprecate(
      `work(task(${handle.simpleTask.options.name}))`,
      (key) => `${key}: work(task(...), ...) is deprecated.`
    );
    return new WorkElement(handle.simpleTask, args) as SimpleJob<any>;
    // return handle(...args) as Job<any>;
  }
  return new WorkElement(handle as SimpleJobDefinition, args) as SimpleJob<any>;
  return {
    __handle: handle,
    __input: args,
    [SLUGIFY]() {
      return getTask(handle).slug(args);
    },
  } as any;
}

// export function bind<Handle extends SimpleJobDefinition>(
//   handle: Handle,
//   ...args: SimpleJobParameters<Handle>
// ): SimpleJob<Handle>;
// export function bind(...args: any): SimpleJob<any>;
// export function bind(...args): SimpleJob<any> {}

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

type JOutput = SimpleJob<
  SimpleJobDefinition<any, any, PromiseOption<ReferenceObject<any>>>
>;
type JReturn = SimpleJobHandleReturn<() => number>;
const jjjj = (num: string) => Number(num);
jjjj.options = {
  before(args: [bigint]) {
    return args;
  },
  after(output: number) {
    return { output };
  },
};
type J2 = SimpleJob<typeof jjjj>;
type J3 = SimpleJobDefinitionInput<typeof jjjj>;
type J4 = SimpleJobDefinitionOutput<typeof jjjj>;
type J5 = typeof jjjj extends {
  options?: SimpleJobOptions<any, infer BeforeInput, any>;
}
  ? { before: BeforeInput }
  : never;
type J6 = typeof jjjj extends SimpleJobDefinition<
  SimpleJobHandle<infer HandleInput, any>,
  any,
  any
>
  ? { handle: HandleInput }
  : never;
type J7 = typeof jjjj extends SimpleJobHandle<infer HandleInput, any>
  ? HandleInput
  : never;
// const jj = work(jjjj, "1234");

const j5 = (num: string) => Number(num);
j5.options = {
  middleware(
    handle: (num: string) => number
  ): ([num]: [bigint], slug: Slug) => { output: number } & MaySlug {
    return ([num], slug) =>
      overwriteObjectSlug({ output: handle(String(num)) }, slug);
  },
};
const j55 = work(j5, 1n);

const j6 = () => 1;
const j66 = work(j6);

const j7 = (num: string) => Number(num);
const j77 = work(j7, "123");

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
  // console.log("run", job);
  const parentContext = activeContext;
  try {
    if (isSimpleJob(job)) {
      const task = getTask(job.__handle);
      const slug = task.slug(job.__input);
      let contextCollection = findOrCreateContextCollection<J>(slug, job);
      // console.log("run", slug, Boolean(contextCollection.work));
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
      // console.log("begin", slug.__slug);
      let contextCollection = findOrCreateContextCollection<J>(slug, job);
      let work = contextCollection.work;
      // if (!work) {
      // let jobContext = contextMap.get(slug);
      // let work = workMap.get(slug);
      // let work = null as Work;
      if (!work || !contextCollection.upToDate) {
        // let jobContext = contextMap.get(slug);
        // if (!jobContext) {
        const jobContext: RunContext = createContext<J>(
          job,
          slug,
          contextCollection,
          parentContext
        );
        // if (isCacheable(slug)) {
        //   contextMap.set(slug, jobContext);
        // }
        // }
        // if (parentContext) {
        //   parentContext.dependencies.add(jobContext);
        // }
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
                  // console.log("release guard", guardItem);
                  return guardItem.release();
                })
              );
            }
          }
        })().then(result, resultError);
        jobContext.work = work;
        // work.catch(e => {console.error('error', slug.__slug, e); throw e;}).then(() => console.log("finish", slug.__slug));
        if (isCacheable(slug)) {
          // contextMap.set(slug, jobContext);
          contextCollection.main = jobContext;
        } else {
          // console.log("uncacheable", slug);
        }
      } else {
        // console.log("copy", slug.__slug);
        createRepeatContext(job, slug, contextCollection, parentContext);
      }
      const output = await work;
      // console.log("finish", slug.__slug);
      return output.unwrap();
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
        // console.log(isJob(job), isOutput(Slug(job)), job);
        // console.log(Slug(job));
        const contextCollection = findOrCreateContextCollection(slug, job);
        const jobContext = createRepeatContext(
          job,
          slug,
          contextCollection,
          parentContext
        );
        if (isCacheable(slug)) {
          // contextMap.set(slug, jobContext);
          contextCollection.main = jobContext;
        } else {
          // console.log("uncacheable", slug);
        }
        // parentContext.dependencies.add(job);
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

// export const walkMapContext = <T>(context: RunContext, map: (context: RunContext, walkMap: (context: RunContext) => T[], path: string[], root: RunContext) => T) =>

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

// const m = await run({});

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

// const pp = await run(props({ data: json(source("{}")) }));

// const v = await run(promise(Promise.resolve({ id: 0 })));

// const g = await run(get(promise(Promise.resolve({ id: 0 })), "id"));

// const t = await run(then(json(source("{}")), (obj) => ({ id: 1, ...obj })));

// const clipsDefinition = await run(json(source("{}")));
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

// export const resource = <T>(handle: () => T): ResourceFactory<T> => {};

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
      // context.upToDate = false;
      // context.main = null;
    }
  }
};
