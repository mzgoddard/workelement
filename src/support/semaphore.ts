import { Deferred, defer } from "./defer";
import { SingletonThread } from "./singleton-thread";
import { Slug, SlugUncacheable } from "../core/slug";

export class Semaphore {
  count: number = 0;
  limit: number;

  private queue: Deferred<SemaphoreGuard>[] = [];

  private lockThread = new SingletonThread(this.lockThreadBody.bind(this));

  constructor(limit: number) {
    this.limit = limit;
  }

  get available() {
    return this.limit - this.count;
  }

  lock(): Promise<SemaphoreGuard> {
    const deferred = defer<SemaphoreGuard>();
    this.queue.push(deferred);
    this.lockThread.run();
    return deferred.promise;
  }

  release(): Promise<void> {
    this.count--;
    this.lockThread.run();
    return Promise.resolve();
  }

  private async lockThreadBody() {
    await Promise.resolve();
    await Promise.resolve();
    while (this.available > 0 && this.queue.length > 0) {
      this.count++;
      this.queue.shift().resolve(new SemaphoreGuard(this));
      await Promise.resolve();
      await Promise.resolve();
    }
  }
}

export class SemaphoreGuard {
  target: Semaphore;

  release: () => Promise<void>;

  constructor(target: Semaphore) {
    this.target = target;
    this.release = () => {
      this.target.release();
      this.release = () => Promise.resolve();
      return Promise.resolve();
    };
  }
}


