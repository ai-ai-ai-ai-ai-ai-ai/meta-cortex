import {
  type Job,
  WorkingDirectory,
} from "../../../../../../../../lace/src/ts/lace.ts";

const receipt: Job = {
  stages: {
    verifyReceipt: {
      ShellCommand: {
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run --filter @meta-cortex/lace verify",
      },
    },
  },
};

export default receipt;
