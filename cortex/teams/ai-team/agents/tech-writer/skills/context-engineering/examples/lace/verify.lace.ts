import { type Job, WorkingDirectory } from "@meta-cortex/lace";

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
