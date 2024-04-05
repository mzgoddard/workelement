import { MaySlug } from "../core/slug";

// export const then2 = task(
//   <T>(input: T, onfulfilled?, onrejected?) =>
//     //   Promise.resolve(input).then(onfulfilled, onrejected)
//     null
// );
//  as <T, T1, T2 = T1>(
//   input: JobDerivableInputItem<T>,
//   onfulfilled?: (input: T) => T1 | Promise<T1>,
//   onrejected?: (error: any) => T2 | Promise<T2>
// ) => Job<T1 | T2>;

export interface FunctionObject<F extends (...args: any[]) => any = any>
  extends MaySlug {
  name: string;
  func: F;
}
export const isFunctionObject = (maybe: unknown): maybe is FunctionObject<any> => {
  return Boolean(
    maybe && typeof (maybe as FunctionObject<any>).func === "function"
  );
};
