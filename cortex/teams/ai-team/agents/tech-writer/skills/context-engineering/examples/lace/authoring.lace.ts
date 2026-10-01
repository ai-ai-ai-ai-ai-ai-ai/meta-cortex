import {
  type Job,
  TaskKind,
  PromptKind,
} from "../../../../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

const checks: Job = { entries: { compile: compile, verify: verify } };

const receipt: Job = {
  entries: {
    context: context,
    step2: {
      kind: TaskKind.Statement,
      prompt: {
        kind: PromptKind.BulletList,
        label: "Receipt authoring",
        items: [
          {
            kind: PromptKind.Statement,
            content:
              "Write the assigned Cortex context receipt using the existing Lace types.",
          },
          {
            kind: PromptKind.Statement,
            content:
              "Keep the Lace core and its verification configuration unchanged.",
          },
          {
            kind: PromptKind.Statement,
            content: "Express context selection as literal prompt content.",
          },
          {
            kind: PromptKind.Statement,
            content: "Reuse canonical context jobs through static imports.",
          },
        ],
      },
    },
    checks: checks,
  },
};

export default receipt;
