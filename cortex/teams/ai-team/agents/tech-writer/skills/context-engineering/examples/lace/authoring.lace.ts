import { type Job } from "@meta-cortex/lace";
import { readContext } from "./context.lace.ts";
import { compileReceipt } from "./compile.lace.ts";
import { verifyReceipt } from "./verify.lace.ts";
const receipt: Job = {
  stages: {
    readContext: readContext,
    authorReceipt: {
      spec: {},
      Required: {
        statements: {
          writeReceipt:
            "Write the assigned Cortex context receipt using the existing Lace types.",
          preserveCore:
            "Keep the Lace core and its verification configuration unchanged.",
          literalSelection:
            "Express context selection as literal statement content.",
          reuseContext:
            "Reuse canonical Stage and Statement declarations through static imports.",
        },
      },
      Prohibited: { statements: {} },
    },
    compileReceipt: compileReceipt,
    verifyReceipt: verifyReceipt,
  },
};
export default receipt;
