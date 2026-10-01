import { type Job, WorkingDirectory } from "@meta-cortex/lace";

const receipt: Job = {
  stages: {
    compile: {
      ShellCommand: {
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run check",
      },
    },
  },
};

export default receipt;
