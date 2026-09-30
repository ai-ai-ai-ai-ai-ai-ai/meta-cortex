import { resolve } from "node:path";
import ts from "typescript";

type CompilerSourceRequest = Parameters<ts.CompilerHost["getSourceFile"]>;
type CompilerMessages = readonly string[];

/** Compile a virtual receipt against the real model without evaluating it. */
export class ReceiptCompilation {
  private static readonly path = resolve(
    import.meta.dirname,
    "compiler-case.lace.ts",
  );
  private static readonly options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };

  constructor(private readonly source: string) {}

  messages(): CompilerMessages {
    const host = ts.createCompilerHost(ReceiptCompilation.options);
    const readSource = host.getSourceFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    // Module resolution must see the same virtual source as getSourceFile.
    host.fileExists = (path) => {
      switch (path) {
        case ReceiptCompilation.path:
          return true;
        default:
          return fileExists(path);
      }
    };
    // Preserve CompilerHost.getSourceFile's fixed positional callback contract.
    host.getSourceFile = (...request: CompilerSourceRequest) => {
      switch (request[0]) {
        case ReceiptCompilation.path:
          return ts.createSourceFile(request[0], this.source, request[1]);
        default:
          return readSource(...request);
      }
    };
    const request: ts.CreateProgramOptions = {
      rootNames: [ReceiptCompilation.path],
      options: ReceiptCompilation.options,
      host,
    };
    const program = ts.createProgram(request);
    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
  }
}
