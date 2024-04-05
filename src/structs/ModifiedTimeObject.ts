import { slug } from "../core/slug";
import { DateObject } from "./DateObject";
import { PathObject } from "./PathObject";


export interface ModifiedTimeObject extends DateObject {
  modifiedTime: Date;
}

export const ModifiedTimeStruct = (
  path: PathObject,
  modifiedTime: Date
): ModifiedTimeObject => ({
  modifiedTime,
  getDate: () => modifiedTime,
  toSlug: () => slug`modifiedTime(${path})`,
});
