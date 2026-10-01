import {
  type Job,
  type Stage,
  type Statement,
  WorkingDirectory,
} from "@meta-cortex/lace";
export const readContext: Statement = "Read context.";
export const compileContext: Statement = {
  content: "Compile context.",
  ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99" },
};
export const context: Stage = {
  spec: { readContext: readContext },
  Required: { statements: { compileContext: compileContext } },
  Prohibited: { statements: {} },
};
const receipt: Job = { stages: { context: context } };
export default receipt;
