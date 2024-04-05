export interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (error?: any) => void;
}

export function defer<T>() {
  let resolve: Deferred<T>['resolve'], reject: Deferred<T>['reject'];
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {
    promise,
    resolve,
    reject,
  } as Deferred<T>;
}
