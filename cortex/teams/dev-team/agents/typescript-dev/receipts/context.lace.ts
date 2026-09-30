import { type Job, TaskKind } from "../../../../../lace/src/ts/lace.ts";

export default [
  {
    kind: TaskKind.Instruction,
    text: "Identify the consuming project root and Cortex library root before using these example tasks. Reuse the existing tool installation and the library's shared dependencies.",
  },
] as const satisfies Job;
