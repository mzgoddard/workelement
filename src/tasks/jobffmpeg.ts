import { JobFactory, guardScope, task } from "../core/jobcall";
import { ExecOptions, exec } from "./jobprocess";
import {
  ExecCommandArrayStruct,
  ExecCommandObject,
} from "../structs/ExecCommandObject";
import { after } from "./jobutil";
import { semaphore, semaphoreGuard } from "./semaphore";
import { SemaphoreObject } from "../structs/SemaphoreObject";

export const ffmpeg = task(
  (args: ExecCommandObject, options?: ExecOptions) => {
    return guardScope(
      after(
        semaphoreGuard(ffmpegSemaphore()),
        exec(ExecCommandArrayStruct(["ffmpeg", args]))
      )
    );
  },
  { name: "ffmpeg" }
);

export const ffmpegSemaphore = (() => semaphore("ffmpeg")) as JobFactory<
  [],
  SemaphoreObject
>;
