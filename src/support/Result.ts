export class Result<T> {
  #result: T;
  constructor(result: T) {
    this.#result = result;
  }
  unwrap() {
    return this.#result;
  }
  static try<F extends (...args: any) => any>(
    fn: F,
    ...args: Parameters<F>
  ): Result<ReturnType<F>> | ResultError {
    try {
      return new Result(fn(...(args as any)));
    } catch (error) {
      return new ResultError(error);
    }
  }
}
export class ResultError {
  #error: any;
  constructor(error: any) {
    this.#error = error;
  }
  unwrap() {
    throw this.#error;
  }
}
export function result<T>(result: T) {
  return new Result(result);
}
export function resultError(error: any) {
  return new ResultError(error);
}
