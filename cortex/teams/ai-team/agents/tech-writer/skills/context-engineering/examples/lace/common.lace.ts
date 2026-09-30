import { Job } from "../../../../../../../../lace/src/ts/lace.ts";
import context from "./context.lace.ts";
import compile from "./compile.lace.ts";
import verify from "./verify.lace.ts";

export default Job.job(context).job(compile).job(verify);
