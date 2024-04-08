import { exec as __exec } from "child_process";
import type { ExecOptions } from "child_process";
import { promisify } from "util";
import { run, task } from "../core/jobcall";
import { all } from "./util";
import {
  ExecCommandPart,
  ExecCommandArrayStruct,
  ExecCommandObject,
  getCommand,
} from "../structs/ExecCommandObject";

export { ExecOptions };

export const command = (
  strings: TemplateStringsArray,
  ...args: ExecCommandPart[]
) => {
  return ExecCommandArrayStruct(
    strings.flatMap((s, i) => [s, args[i]].filter(Boolean))
  );
};

const _exec = promisify(__exec);
export const exec = task(
  async function exec(
    command: ExecCommandObject | string,
    options?: ExecOptions
  ) {
    const child = _exec(getCommand(command), options ?? {});
    child.child.stdin.end();
    return { command, exec: await run(child) };
  },
  { name: "exec" }
);
