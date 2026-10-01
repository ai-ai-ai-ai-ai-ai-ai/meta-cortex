import { type Job, TaskKind, WorkingDirectory } from "../../src/ts/lace.ts";

const receipt: Job = {
  entries: {
    compile: {
      kind: TaskKind.ShellCommand,
      cwd: WorkingDirectory.LibraryRoot,
      script: "bun run check",
    },
  },
};

export default receipt;
