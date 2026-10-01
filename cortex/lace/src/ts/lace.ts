/**
 * Neural Lace is the declaration language for Cortex context files.
 * Context authors use it for instructions, skills, and practices read by agents.
 * Read receipt files as text; do not import them to execute code.
 * Each receipt exports one Job. Jobs are directories; tasks are files.
 * Readonly Job objects group tasks and other jobs.
 * Statically declared jobs compose through imports without name-keyed lookup.
 */
/** Command locations resolve from the consuming session's two explicit roots. */
export enum WorkingDirectory {
  ProjectRoot = "project-root",
  LibraryRoot = "library-root",
}

/** Plain prompt payloads are wrapped only when used as Prompt variants. */
export interface PromptStatement {
  readonly content: string;
}

export interface BulletList {
  readonly label?: string;
  readonly items: Readonly<
    Record<
      string,
      | string
      | { readonly BulletList: BulletList; readonly PromptStatement?: never }
    >
  >;
}

export type Prompt =
  | { readonly PromptStatement: PromptStatement; readonly BulletList?: never }
  | { readonly BulletList: BulletList; readonly PromptStatement?: never };

export abstract class PromptStatement {
  static content(content: string): {
    readonly PromptStatement: PromptStatement;
    readonly BulletList?: never;
  } {
    return { PromptStatement: { content } };
  }
}

/** Literal Cortex prose payload. */
export interface Statement {
  readonly prompt: Prompt;
}

/** Inert shell text payload; compilation and importing never run its command. */
export interface ShellCommand {
  readonly cwd: WorkingDirectory;
  readonly script: string;
}

/** Closed task variants wrap their concrete payloads. */
export type Task =
  | { readonly Statement: Statement; readonly ShellCommand?: never }
  | { readonly ShellCommand: ShellCommand; readonly Statement?: never };

/** Each stage is either a nested job or a task. */
export type Stage = Job | Task;

/** A directory of ordered context stages, declared as a plain object. */
export interface Job {
  readonly stages: Readonly<Record<string, Stage>>;
}
