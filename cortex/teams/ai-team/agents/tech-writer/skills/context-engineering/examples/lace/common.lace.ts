import { type Job } from "@meta-cortex/lace";
import { readContext } from "./context.lace.ts";
import { compileReceipt } from "./compile.lace.ts";
import { verifyReceipt } from "./verify.lace.ts";
const receipt: Job = {
  stages: {
    readContext: readContext,
    compileReceipt: compileReceipt,
    verifyReceipt: verifyReceipt,
  },
};
export default receipt;
