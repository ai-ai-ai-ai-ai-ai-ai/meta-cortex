/** Neural Lace declares agent context as plain readonly data. Read receipts as text. */
export enum WorkingDirectory {
  ProjectRoot = "project-root",
  LibraryRoot = "library-root",
}

export interface ShellCommand {
  readonly cwd: WorkingDirectory;
  readonly script: string;
}

export type Statement =
  string | { readonly content: string; readonly ShellCommand: ShellCommand };

export interface Required {
  readonly statements: Readonly<Record<string, Statement>>;
}

export interface Prohibited {
  readonly statements: Readonly<Record<string, Statement>>;
}

export interface Stage {
  readonly spec: Readonly<Record<string, Statement>>;
  readonly Required: Required;
  readonly Prohibited: Prohibited;
}

export interface Job {
  readonly stages: Readonly<Record<string, Stage>>;
}
