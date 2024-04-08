import { MaySlug, SLUGIFY, Sluggable, slug } from "../core/slug";
import { absolutePath } from "../tasks/nodefs";
import { PathObject } from "./PathObject";

export interface ExecCommandObject extends MaySlug {
  getCommand(): string;
}

export type ExecCommandPart = (
  | ExecCommandObject
  | { toString(): string }
  | string
) &
  Sluggable;

export const ExecCommandArrayStruct = (
  pieces: ExecCommandPart[]
): ExecCommandObject => ({
  getCommand() {
    return pieces.map(getCommand).join(" ");
  },
  [SLUGIFY]() {
    return slug`execCommandArray(${slug(
      pieces.map((_, i) => (i > 0 ? " " : "")) as any,
      ...pieces
    )})`;
  },
});

export const ExecCommandPathStruct = (path: PathObject): ExecCommandObject => ({
  getCommand() {
    return JSON.stringify(absolutePath(path));
  },
  [SLUGIFY]() {
    return slug`execCommandPath(${path})`;
  },
});
const isExecCommandObject = (maybe: unknown): maybe is ExecCommandObject =>
  Boolean(maybe && (maybe as ExecCommandObject).getCommand);

export const getCommand = (command: ExecCommandObject | string) => {
  if (isExecCommandObject(command)) {
    return command.getCommand();
  }
  return String(command);
};
