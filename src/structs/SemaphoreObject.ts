import { MaySlug, slug } from "../core/slug";
import { Semaphore } from "../support/semaphore";


export interface SemaphoreObject extends MaySlug {
  name: string;
  semaphore: Semaphore;
}

export const SemaphoreStruct = (
  name: string,
  semaphore: Semaphore
): SemaphoreObject => ({
  name,
  semaphore,
  toSlug: () => slug`semaphoreStruct(${name})`,
});
