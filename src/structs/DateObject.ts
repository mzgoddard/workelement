import { MaySlug, SLUGIFY, slug } from "../core/slug";

export const GET_DATE: unique symbol = Symbol.for("workelement.getDate");

export interface DateObject extends MaySlug {
  [GET_DATE](): Date;
}

class DateBase implements DateObject {
  #id: string;
  #date: Date;
  constructor(id: string, date: Date) {
    this.#id = id;
    this.#date = date;
  }
  [GET_DATE]() {
    return this.#date;
  }
  [SLUGIFY]() {
    return slug`date(${this.#id})`;
  }
}

export const DateStruct = (id: string, date: Date): DateObject =>
  new DateBase(id, date);

export const beginningOfTime = () => DateStruct("beginningOfTime", new Date(0));

export const getDate = (obj: DateObject): Date => {
  return obj[GET_DATE]();
};
