import {
  type Job,
  TaskKind,
} from "../../../../../../../../lace/src/ts/lace.ts";

export default [
  {
    kind: TaskKind.Instruction,
    text: "Read lace/AGENTS.md and lace/src/ts/lace.ts from the Cortex library root before authoring Cortex context files. Lace contains type definitions and validation code. Write context receipts beside their owning context outside lace/. These examples demonstrate the context format and its existing checks.",
  },
] as const satisfies Job;
