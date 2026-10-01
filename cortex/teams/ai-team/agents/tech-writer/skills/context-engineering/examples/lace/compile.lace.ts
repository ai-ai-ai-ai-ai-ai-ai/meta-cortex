import { type Job, type Stage, WorkingDirectory } from "@meta-cortex/lace";
export const compileReceipt: Stage = {
  spec: {},
  Required: {
    statements: {
      compileDeclarations: {
        content: "Compile the receipt declarations.",
        ShellCommand: {
          cwd: WorkingDirectory.LibraryRoot,
          script: "bun run --filter @meta-cortex/lace check",
        },
      },
    },
  },
  Prohibited: { statements: {} },
};
const receipt: Job = { stages: { compileReceipt: compileReceipt } };
export default receipt;
