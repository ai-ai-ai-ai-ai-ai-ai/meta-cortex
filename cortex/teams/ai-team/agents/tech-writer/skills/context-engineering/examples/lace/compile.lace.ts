import {
  type Job,
  TaskKind,
  WorkingDirectory,
} from "../../../../../../../../lace/src/ts/lace.ts";

export default [
  {
    kind: TaskKind.ShellCommand,
    cwd: WorkingDirectory.LibraryRoot,
    script: "bun run --filter @meta-cortex/lace check",
  },
] as const satisfies Job;
