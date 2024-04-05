import { defer } from "./defer";

const lockQueue = [];

export async function microtaskLock() {
  const deferred = defer();
  lockQueue.push(deferred);
  microtaskLockThread();
  await deferred.promise;
}

let activeLockThread = false;
async function microtaskLockThread() {
  if (activeLockThread) return;
  try {
    activeLockThread = true;
    while (lockQueue.length) {
      lockQueue.shift().resolve();
      await Promise.resolve();
      await Promise.resolve();
    }
  } finally {
    activeLockThread = false;
  }
}
