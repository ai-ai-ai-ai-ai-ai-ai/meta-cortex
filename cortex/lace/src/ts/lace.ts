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
  Statement = "statement",
  ShellCommand = "shell-command",
}

/** Command locations resolve from the consuming session's two explicit roots. */
export enum WorkingDirectory {
  ProjectRoot = "project-root",
  LibraryRoot = "library-root",
}

/** Standard prompt shapes keep prose and list structure explicit. */
export enum PromptKind {
  Paragraph = "paragraph",
  BulletList = "bullet-list",
  EnclosedList = "enclosed-list",
}

export interface Paragraph {
  readonly kind: PromptKind.Paragraph;
  readonly content: string;
}

export interface BulletList {
  readonly kind: PromptKind.BulletList;
  readonly items: readonly string[];
}

export interface EnclosedListItem {
  readonly label: string;
  readonly items: readonly string[];
}

export interface EnclosedList {
  readonly kind: PromptKind.EnclosedList;
  readonly items: readonly EnclosedListItem[];
}

export type Prompt = Paragraph | BulletList | EnclosedList;

/** Literal Cortex prose: explanations, specifications, rules, and instructions. */
export interface Statement {
  readonly kind: TaskKind.Statement;
  readonly prompt: Prompt;
}

/** Declared shell text. Compilation and importing never run this command. */
export interface ShellCommand {
  readonly kind: TaskKind.ShellCommand;
  readonly cwd: WorkingDirectory;
  readonly script: string;
}

/** The task vocabulary is closed: no callbacks, scripts-as-functions, or flags. */
export type Task = Statement | ShellCommand;

/** Each entry is either a nested job or a task. */
export type Entry = Job | Task;

/** Construction checks context declarations; it never executes their commands. */
export class Job {
  readonly #content: readonly Entry[];

  constructor(...entries: Entry[]) {
    const statement: Pick<Statement, "kind"> = {
      kind: TaskKind.Statement,
    };
    const shellCommand: Pick<ShellCommand, "kind"> = {
      kind: TaskKind.ShellCommand,
    };
    this.#content = Object.freeze(
      entries.map((entry) =>
        Match.value(entry).pipe(
          Match.when(statement, (task) => {
            const snapshot: Statement = {
              ...task,
              prompt: this.#snapshotPrompt(task.prompt),
            };
            return Object.freeze(snapshot);
          }),
          Match.when(shellCommand, (task) => {
            const snapshot: ShellCommand = { ...task };
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

  #snapshotPrompt(prompt: Prompt): Prompt {
    switch (prompt.kind) {
      case PromptKind.Paragraph: {
        const snapshot: Paragraph = { ...prompt };
        return Object.freeze(snapshot);
      }
      case PromptKind.BulletList: {
        const snapshot: BulletList = {
          ...prompt,
          items: Object.freeze([...prompt.items]),
        };
        return Object.freeze(snapshot);
      }
      case PromptKind.EnclosedList: {
        const items = prompt.items.map((item) => {
          const snapshot: EnclosedListItem = {
            ...item,
            items: Object.freeze([...item.items]),
          };
          return Object.freeze(snapshot);
        });
        const snapshot: EnclosedList = {
          ...prompt,
          items: Object.freeze(items),
        };
        return Object.freeze(snapshot);
      }
    }
  }
}
