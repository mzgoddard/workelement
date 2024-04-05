const TraitSymbol: unique symbol = Symbol.for("workelement.trait");
type TraitSymbol = typeof TraitSymbol;

interface TraitObject<Name extends symbol, Trait> {
  [TraitSymbol]: {
    [Key in Name]: Trait;
  };
}

const DateSymbol: unique symbol = Symbol.for('workelement.date');
type DateSymbol = typeof DateSymbol;

interface DateTrait<T> {
  getDate(obj: T): Date;
}

type DateTraitObject<T> = TraitObject<DateSymbol, DateTrait<T>>

type FunctionKeys<T> = {
  [Key in keyof T]: T[Key] extends (...args: any) => any ? Key : never;
}[any];

type PickFunctions<T> = T extends { [key: string]: any }
  ? { [Key in FunctionKeys<T>]: T[Key] }
  : T;

const trait = <Name extends symbol, Trait>(
  obj: TraitObject<Name, Trait>,
  name: Name
): Trait => obj[TraitSymbol][name];

type Tail<T extends [] | any[]> = T extends []
  ? []
  : T extends [infer _, ...infer Rest]
  ? Rest
  : T;

const callTrait = <
  Name extends symbol,
  Trait,
  Method extends FunctionKeys<Trait>
>(
  obj: TraitObject<Name, Trait>,
  name: Name,
  method: Method,
  ...args: Tail<Parameters<Extract<Trait[Method], (...args: any) => any>>>
): ReturnType<Extract<Trait[Method], (...args) => any>> =>
  (trait(obj, name)[method] as (...args: any) => any)(...(args as any));

type Trait<T> = {
    [Key in string]: (obj: T, ...args: any) => any;
}

type TraitTable = {
    [Key in symbol]: Trait<any>;
}

const traits = <T extends TraitTable>(init: () => T) => {};
