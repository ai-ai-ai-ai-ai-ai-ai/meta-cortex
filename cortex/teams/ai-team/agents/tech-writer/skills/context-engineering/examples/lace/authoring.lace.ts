import {
  type Job,
  TaskKind,
  PromptKind,
} from "../../../../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

const checks: Job = { entries: [compile, verify] };

const receipt: Job = {
  entries: [
    context,
    {
      kind: TaskKind.Statement,
      prompt: {
        kind: PromptKind.BulletList,
        label: "Receipt authoring",
        items: [
          "Write the assigned Cortex context receipt using the existing Lace types.",
          "Keep the Lace core and its verification configuration unchanged.",
          "Express context selection as literal prompt content.",
          "Reuse canonical context jobs through static imports.",
        ],
      },
    },
    checks,
  ],
};

export default receipt;
