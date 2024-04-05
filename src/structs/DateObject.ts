import { MaySlug, slug } from "../core/slug";

const TraitSymbol: unique symbol = Symbol.for("workelement.trait");
type TraitSymbol = typeof TraitSymbol;

interface TraitObject<Name extends symbol, Trait> {
  [TraitSymbol]: {
    [Key in Name]: Trait;
  };
}

const DateSymbol = "Date";

interface DateTrait<T> {
  getDate(obj: T): Date;
}

type FunctionKeys<T> = {
  [Key in keyof T]: T[Key] extends (...args: any) => any ? Key : never;
}[any];

type PickFunctions<T> = T extends { [key: string]: any }
  ? { [Key in FunctionKeys<T>]: T[Key] }
  : T;

const trait = <Name extends string, Trait>(
  obj: TraitObject<Name, Trait>,
  name: Name
): Trait => obj.table[name];

type Tail<T extends [] | any[]> = T extends []
  ? []
  : T extends [infer _, ...infer Rest]
  ? Rest
  : T;

const callTrait = <
  Name extends string,
  Trait,
  Method extends FunctionKeys<Trait>
>(
  obj: TraitObject<Name, Trait>,
  name: Name,
  method: Method,
  ...args: Tail<Parameters<Extract<Trait[Method], (...args: any) => any>>>
): ReturnType<Extract<Trait[Method], (...args) => any>> =>
  (trait(obj, name)[method] as (...args: any) => any)(...(args as any));

const getDateFromTrait = <T>(
  obj: TraitObject<typeof DateSymbol, DateTrait<T>>
) => callTrait(obj, DateSymbol, "getDate" as const);

export interface DateObject extends MaySlug {
  getDate(): Date;
}

export const DateStruct = (id: string, date: Date): DateObject => ({
  getDate: () => date,
  toSlug: () => slug`date(${id})`,
});

export const beginningOfTime = () => DateStruct("beginningOfTime", new Date(0));

export const getDate = (obj: DateObject): Date => {
  return obj.getDate();
};
