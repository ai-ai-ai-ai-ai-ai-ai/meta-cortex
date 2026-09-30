import { type Job, TaskKind } from "../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

export default [
  context,
  {
    kind: TaskKind.Instruction,
    text: "Create or update the assigned receipt using the existing Lace types. Keep all core files and verification configuration unchanged. Express conditions as instruction text and reusable work as statically imported jobs.",
  },
  [compile, verify],
] as const satisfies Job;
