/**
 * Neural Lace is the declaration language for Cortex context files.
 * Context authors use it for instructions, skills, and practices read by agents.
 * Read receipt files as text; do not import them to execute code.
 * Each receipt exports one Job. Jobs are directories; tasks are files.
 * A Job instance groups tasks and other jobs through its constructor.
 * Statically declared jobs compose through imports without name-keyed lookup.
 */
export enum TaskKind {
  Instruction = "instruction",
  ShellCommand = "shell-command",
}

/** Command locations resolve from the consuming session's two explicit roots. */
export enum WorkingDirectory {
  ProjectRoot = "project-root",
  LibraryRoot = "library-root",
}

/** Prose for the agent to interpret, including conditions and context selection. */
export interface Instruction {
  readonly kind: TaskKind.Instruction;
  readonly text: string;
}

/** Declared shell text. Compilation and importing never run this command. */
export interface ShellCommand {
  readonly kind: TaskKind.ShellCommand;
  readonly cwd: WorkingDirectory;
  readonly script: string;
}

/** The task vocabulary is closed: no callbacks, scripts-as-functions, or flags. */
export type Task = Instruction | ShellCommand;

/** Construction checks context declarations; it never executes their commands. */
export class Job {
  private readonly content: readonly (Job | Task)[];

  constructor(...entries: (Job | Task)[]) {
    this.content = entries;
  }

  get entries(): readonly (Job | Task)[] {
    return this.content;
  }
}
