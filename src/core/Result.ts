export class Result<T> {
  #result: T;
  constructor(result: T) {
    this.#result = result;
  }
  unwrap() {
    return this.#result;
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
