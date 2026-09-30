/**
 * Neural Lace is Cortex's agent-readable declaration language.
 * Read receipt files as text; do not import them to execute code.
 * Each receipt exports one Job. Jobs are directories; tasks are files.
 * A job's named children contain other jobs or either of the two task kinds.
 * Imported jobs and children compose the same tree without copying instructions.
 */
export enum NodeKind {
  Job = "job",
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
  readonly kind: NodeKind.Instruction;
  readonly text: string;
}

/** Declared shell text. Compilation and importing never run this command. */
export interface ShellCommand {
  readonly kind: NodeKind.ShellCommand;
  readonly cwd: WorkingDirectory;
  readonly script: string;
}

/** The task vocabulary is closed: no callbacks, scripts-as-functions, or flags. */
export type Task = Instruction | ShellCommand;

export type LaceNode = Job | Task;

/**
 * This is the receipt's declaration format, not an untyped application record.
 * Property names identify files/directories; every value is a concrete LaceNode.
 * Source order is reading order. The receipt grammar requires nonempty children.
 */
export interface JobChildren {
  readonly [name: string]: LaceNode;
}

export interface Job {
  readonly kind: NodeKind.Job;
  readonly children: JobChildren;
}
