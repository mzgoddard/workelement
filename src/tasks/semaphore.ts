import { JobDerivableInputItem, JobFactory, addGuard, task } from "../core/run";
import { slug } from "../core/slug";
import { SemaphoreStruct, SemaphoreObject } from "../structs/SemaphoreObject";
import { Semaphore } from "../support/semaphore";

export const DEFAULT_SEMAPHORE = 8;

export const semaphore = task(
  (name: string) => SemaphoreStruct(name, new Semaphore(DEFAULT_SEMAPHORE)),
  {
    name: "semaphore",
  }
) as JobFactory<[JobDerivableInputItem<string>], SemaphoreObject>;

export const semaphoreGuard = task(
  async ({ semaphore }: SemaphoreObject) => addGuard(await semaphore.lock()),
  {
    name: "semaphoreGuard",
    slug(semaphore: JobDerivableInputItem<SemaphoreObject>) {
      return slug.uncacheable`semaphoreGuard(${semaphore})`;
    },
  }
);
