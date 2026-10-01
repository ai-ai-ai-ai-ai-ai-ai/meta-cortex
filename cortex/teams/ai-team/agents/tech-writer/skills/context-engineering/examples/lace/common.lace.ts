import { type Job } from "../../../../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

const receipt: Job = {
  stages: { context: context, compile: compile, verify: verify },
};

export default receipt;
