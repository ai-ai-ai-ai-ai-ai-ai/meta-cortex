import { type Job, WorkingDirectory } from "@meta-cortex/lace";

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
