import {
  Job,
  WorkingDirectory,
} from "../../../../../../../../lace/src/ts/lace.ts";

export default Job.shellCommand({
  cwd: WorkingDirectory.LibraryRoot,
  script: "bun run --filter @meta-cortex/lace check",
});
