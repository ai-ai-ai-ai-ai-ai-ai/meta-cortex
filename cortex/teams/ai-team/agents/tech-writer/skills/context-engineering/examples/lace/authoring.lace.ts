import {
  Job,
  TaskKind,
  PromptKind,
} from "../../../../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

export default new Job(
  context,
  {
    kind: TaskKind.Statement,
    prompt: {
      kind: PromptKind.BulletList,
      items: [
        "Write the assigned Cortex context receipt using the existing Lace types.",
        "Keep the Lace core and its verification configuration unchanged.",
        "Express context selection as literal prompt content.",
        "Reuse canonical context jobs through static imports.",
      ],
    },
  },
  new Job(compile, verify),
);
