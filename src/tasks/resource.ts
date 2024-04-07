import { defer } from "../support/defer";
import {
  Guard,
  Job,
  addGuard,
  getThisContext,
  run,
  task,
} from "../core/jobcall";
import { Semaphore, SemaphoreGuard } from "../support/semaphore";
import { MaySlug, SLUGIFY, slug } from "../core/slug";

// interface Resource<T> {
//   item: T;
//   release(): Promise<void>;
// }

// interface ResourcePool<T> {
//   lock(): Promise<Resource<T>>;
// }

// export const guard = task(async (pool: ResourcePool<any>, deferred: Job) => {
//   const resource = await pool.lock();
//   try {
//     return await run(deferred);
//   } finally {
//     resource.release();
//   }
// });

interface ChildProcessResource extends MaySlug {}

export const ChildProcessResourceStruct = (): ChildProcessResource => ({
  [SLUGIFY]: () => slug`childProcessResource`,
});

interface ChildProcessGuard extends Guard {}

const childProcessSemaphore = new Semaphore(1);

export const ChildProcessGuardStruct = (
  guard: SemaphoreGuard
): ChildProcessGuard => ({
  release: guard.release.bind(guard),
});

export const childProcessPool = task(
  async () => {
    addGuard(ChildProcessGuardStruct(await run(childProcessSemaphore.lock())));
    return ChildProcessResourceStruct();
  },
  { name: "childProcessPool", slug: () => slug.uncacheable`childProcess` }
);

export const childProcessResource = childProcessPool();

let activeChildProcess = 0;
let activeChildProcessLimit = 1;
let childProcessQueue = [];

const lockChildProcess = async () => {
  console.log("lockChildProcess", childProcessQueue.length);
  const deferred = defer();
  childProcessQueue.push(deferred);
  console.log("lockChildProcess", childProcessQueue.length);
  childProcessQueueThread();
  console.log("lockChildProcess acquiring");
  await deferred.promise;
  console.log("lockChildProcess acquired");
};

const releaseChildProcess = async () => {
  console.log("releaseChildProcess", activeChildProcess);
  activeChildProcess--;
  console.log("releaseChildProcess", activeChildProcess);
  childProcessQueueThread();
};

let activeChildProcessQueueThread = false;

const childProcessQueueThread = async () => {
  if (activeChildProcessQueueThread) {
    return;
  }
  console.log("childProcessQueueThread start");
  await Promise.resolve();
  await Promise.resolve();
  try {
    // activeChildProcessQueueThread = true;
    console.log(
      activeChildProcess,
      activeChildProcessLimit,
      childProcessQueue.length
    );
    while (
      activeChildProcess < activeChildProcessLimit &&
      childProcessQueue.length > 0
    ) {
      // childProcessQueue.forEach(deferred => deferred.resolve());
      // childProcessQueue.length = 0;
      // break;
      activeChildProcess++;
      console.log("lock childProcess");
      console.log(childProcessQueue.length);
      childProcessQueue.shift()?.resolve();
      console.log(childProcessQueue.length);
      //   await Promise.resolve();
    }
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    // activeChildProcessQueueThread = false;
    console.log("childProcessQueueThread stop");
  }
};
