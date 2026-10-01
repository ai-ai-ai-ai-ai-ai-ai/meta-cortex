import {
  type Job,
  TaskKind,
  WorkingDirectory,
} from "../../../../../../../../lace/src/ts/lace.ts";

const receipt: Job = {
  entries: {
    step1: {
      kind: TaskKind.ShellCommand,
      cwd: WorkingDirectory.LibraryRoot,
      script: "bun run --filter @meta-cortex/lace check",
    },
  },
};

export default receipt;
