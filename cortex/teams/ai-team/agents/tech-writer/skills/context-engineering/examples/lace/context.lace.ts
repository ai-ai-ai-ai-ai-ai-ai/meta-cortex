import { Job, TaskKind } from "../../../../../../../../lace/src/ts/lace.ts";

export default new Job({
  kind: TaskKind.Instruction,
  text: "Read lace/AGENTS.md and lace/src/ts/lace.ts from the Cortex library root before authoring Cortex context files. Lace defines the Job class, task types, and validation code. Write context receipts beside their owning context outside lace/. These examples demonstrate the context format and its existing checks.",
});
