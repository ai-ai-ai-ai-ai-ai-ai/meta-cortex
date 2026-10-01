import { type Job, type Stage, WorkingDirectory } from "@meta-cortex/lace";
export const verifyReceipt: Stage = {
  spec: {},
  Required: {
    statements: {
      verifyDeclarations: {
        content: "Verify receipt formatting, grammar, and types.",
        ShellCommand: {
          cwd: WorkingDirectory.LibraryRoot,
          script: "bun run --filter @meta-cortex/lace verify",
        },
      },
    },
  },
  Prohibited: { statements: {} },
};
const receipt: Job = { stages: { verifyReceipt: verifyReceipt } };
export default receipt;
