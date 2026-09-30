import {
  type Job,
  NodeKind,
  WorkingDirectory,
} from "../../../../../lace/src/ts/lace.ts";

export default {
  kind: NodeKind.Job,
  children: {
    context: {
      kind: NodeKind.Instruction,
      text: "Identify the consuming project root and Cortex library root before using these example tasks. Reuse the existing tool installation and the library's shared dependencies.",
    },
    compile_receipts: {
      kind: NodeKind.ShellCommand,
      cwd: WorkingDirectory.LibraryRoot,
      script: "bun run --filter @meta-cortex/lace check",
    },
    verify_receipts: {
      kind: NodeKind.ShellCommand,
      cwd: WorkingDirectory.LibraryRoot,
      script: "bun run --filter @meta-cortex/lace verify",
    },
  },
} as const satisfies Job;
