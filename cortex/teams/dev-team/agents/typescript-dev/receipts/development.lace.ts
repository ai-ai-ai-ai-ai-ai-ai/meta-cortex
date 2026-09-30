import { type Job, NodeKind } from "../../../../../lace/src/ts/lace.ts";
import common from "./common.lace.ts";

export default {
  kind: NodeKind.Job,
  children: {
    context: common.children.context,
    author_receipt: {
      kind: NodeKind.Instruction,
      text: "Create or update the assigned receipt using the existing Lace types. Keep all core files and verification configuration unchanged. Express conditions as instruction text and reusable work as imported jobs or children.",
    },
    checks: {
      kind: NodeKind.Job,
      children: {
        compile: common.children.compile_receipts,
        verify: common.children.verify_receipts,
      },
    },
  },
} as const satisfies Job;
