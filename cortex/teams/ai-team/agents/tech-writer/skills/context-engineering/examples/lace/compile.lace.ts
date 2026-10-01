import {
  type Job,
  WorkingDirectory,
} from "../../../../../../../../lace/src/ts/lace.ts";

const receipt: Job = {
  stages: {
    compileReceipt: {
      ShellCommand: {
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run --filter @meta-cortex/lace check",
      },
    },
  },
};

export default receipt;
