/**
 * Neural Lace is the declaration language for Cortex context files.
 * Context authors use it for instructions, skills, and practices read by agents.
 * Read receipt files as text; do not import them to execute code.
 * Each receipt exports one Job. Jobs are directories; tasks are files.
 * Readonly Job objects group tasks and other jobs.
 * Statically declared jobs compose through imports without name-keyed lookup.
 */
export enum TaskKind {
  Statement = "statement",
}

/** Command locations resolve from the consuming session's two explicit roots. */
export enum WorkingDirectory {
  ProjectRoot = "project-root",
  LibraryRoot = "library-root",
}

/** Standard prompt shapes keep prose and list structure explicit. */
export enum PromptKind {
  Statement = "statement",
  BulletList = "bullet-list",
}

export interface PromptStatement {
  readonly kind: PromptKind.Statement;
  readonly content: string;
}

export abstract class PromptStatement {
  static content(content: string): PromptStatement {
    return { kind: PromptKind.Statement, content };
  }
}

export interface BulletList {
  readonly kind: PromptKind.BulletList;
  readonly label?: string;
  readonly items: readonly Prompt[];
}

export type Prompt = PromptStatement | BulletList;

/** Literal Cortex prose: explanations, specifications, rules, and instructions. */
export interface Statement {
  readonly kind: TaskKind.Statement;
  readonly prompt: Prompt;
}

/** Declared shell text. Compilation and importing never run this command. */
export interface ShellCommand {
  readonly ShellCommand: {
    readonly cwd: WorkingDirectory;
    readonly script: string;
  };
}

/** The task vocabulary is closed: no callbacks, scripts-as-functions, or flags. */
export type Task = Statement | ShellCommand;

/** Each stage is either a nested job or a task. */
export type Stage = Job | Task;

/** A directory of ordered context stages, declared as a plain object. */
export interface Job {
  readonly stages: Readonly<Record<string, Stage>>;
}
