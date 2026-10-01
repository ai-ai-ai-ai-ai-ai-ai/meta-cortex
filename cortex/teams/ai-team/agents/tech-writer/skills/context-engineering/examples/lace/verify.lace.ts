import {
  type Job,
  TaskKind,
  WorkingDirectory,
} from "../../../../../../../../lace/src/ts/lace.ts";

const receipt: Job = {
  stages: {
    verifyReceipt: {
      kind: TaskKind.ShellCommand,
      cwd: WorkingDirectory.LibraryRoot,
      script: "bun run --filter @meta-cortex/lace verify",
    },
  },
};

export default receipt;
