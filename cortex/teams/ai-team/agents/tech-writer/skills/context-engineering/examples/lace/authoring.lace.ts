import {
  type Job,
  TaskKind,
  PromptKind,
  PromptStatement,
} from "../../../../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

const checks: Job = { stages: { compile: compile, verify: verify } };

const receipt: Job = {
  stages: {
    context: context,
    authorReceipt: {
      kind: TaskKind.Statement,
      prompt: {
        kind: PromptKind.BulletList,
        label: "Receipt authoring",
        items: [
          PromptStatement.content(
            "Write the assigned Cortex context receipt using the existing Lace types.",
          ),
          PromptStatement.content(
            "Keep the Lace core and its verification configuration unchanged.",
          ),
          PromptStatement.content(
            "Express context selection as literal prompt content.",
          ),
          PromptStatement.content(
            "Reuse canonical context jobs through static imports.",
          ),
        ],
      },
    },
    checks: checks,
  },
};

export default receipt;
