import { Job, TaskKind } from "../../../../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

export default new Job(
  context,
  {
    kind: TaskKind.Instruction,
    text: "Write the assigned Cortex context receipt using the existing Lace types. Keep the Lace core and its verification configuration unchanged. Express context selection as instruction text and reuse canonical context jobs through static imports.",
  },
  new Job(compile, verify),
);
