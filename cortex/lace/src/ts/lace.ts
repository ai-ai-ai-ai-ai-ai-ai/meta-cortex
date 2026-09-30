import { Match } from "effect";

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

/** Each entry is either a nested job or a task. */
export type Entry = Job | Task;

/** Construction checks context declarations; it never executes their commands. */
export class Job {
  readonly #content: readonly Entry[];

  constructor(...entries: Entry[]) {
    const instruction: Pick<Instruction, "kind"> = {
      kind: TaskKind.Instruction,
    };
    const shellCommand: Pick<ShellCommand, "kind"> = {
      kind: TaskKind.ShellCommand,
    };
    this.#content = Object.freeze(
      entries.map((entry) =>
        Match.value(entry).pipe(
          Match.whenOr(instruction, shellCommand, (task) => {
            const snapshot: Task = { ...task };
            return Object.freeze(snapshot);
          }),
          Match.orElse((job: Job) => job),
        ),
      ),
    );
    Object.freeze(this);
  }

  size(): number {
    return this.#content.length;
  }

  append(entry: Entry): Job {
    return new Job(...this.#content, entry);
  }
}
