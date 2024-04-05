import {
  MaySlug,
  Slug,
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
import { Result, ResultError, result, resultError } from "./Result";

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
  __task: any;
  __input: any;
  __output: Output;
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
        ["toSlug", () => slug],
      ]));
  const initializedSlugerize: JobOptionsOf<Handle>["slugerize"] =
    maybeSlugerize ??
    ((output, slug) => {
      if (output && typeof output === "object" && !Array.isArray(output)) {
        return { ...output, toSlug: () => SlugOutputStruct(slug) };
      } else if (output === undefined || output === null) {
        return SlugOutputStruct(slug);
      }
      return output;
    });
  return {
    name: initializedName,
    handle,
    slug: initializedSlug,
    deriveInput: initializedDeriveInput,
    deriveOutput: initializedDeriveOutput,
    slugerize: initializedSlugerize,
  } as any;
}

export function task<Handle extends JobHandle>(
  handle: Handle,
  options?: JobOptionsOf<Handle>
): RenderJobFactory<JobFactoryOf<Handle>> {
  const task = initTask(handle, options);
  return Object.assign((...input) => ({
    __task: task,
    __input: input,
    toSlug() {
      return task.slug(...input);
    },
  }));
}

type Work<T = any> = Promise<Result<T> | ResultError>;

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

export async function run<J>(
  job: J
): Promise<J extends Job ? DerivedJob<J> : J extends Promise<infer P> ? P : J> {
  const parentContext = activeContext;
  try {
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
        await microtaskLock();
        activeContext = jobContext;
        work = (async () => {
          try {
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
      return (await job) as any;
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
