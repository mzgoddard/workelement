import { MaySlug } from "../core/slug";

export interface FunctionObject<F extends (...args: any[]) => any = any>
  extends MaySlug {
  name: string;
  func: F;
}
export const isFunctionObject = (
  maybe: unknown
): maybe is FunctionObject<any> => {
  return Boolean(
    maybe && typeof (maybe as FunctionObject<any>).func === "function"
  );
};
