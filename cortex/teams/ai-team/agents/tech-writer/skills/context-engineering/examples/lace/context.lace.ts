import { type Job, type Stage } from "@meta-cortex/lace";
import { overview } from "../../../../../../../../lace/AGENTS.ts";
export const readContext: Stage = {
  spec: { contextRoots: "Resolve context paths from the Cortex library root." },
  Required: {
    statements: {
      readCore:
        "Read lace/AGENTS.ts and lace/src/ts/lace.ts as text before authoring receipts.",
    },
  },
  Prohibited: {
    statements: {
      executeContext: "Do not import context to execute commands.",
    },
  },
};
const receipt: Job = {
  stages: { laceOverview: overview, readContext: readContext },
};
export default receipt;
