import { type Job, WorkingDirectory } from "../../src/ts/lace.ts";

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
