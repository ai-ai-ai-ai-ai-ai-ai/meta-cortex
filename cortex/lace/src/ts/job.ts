import { Array as EffectArray } from "effect";
import { type Chunk, append, empty, size } from "effect/Chunk";
import {
  PromptKind,
  TaskKind,
  type BulletList,
  type Command,
  type EnclosedList,
  type Entry,
  type Prompt,
  type PromptStatement,
  type ShellCommand,
  type Statement,
} from "./lace.ts";

/** Construction checks context declarations; it never executes their commands. */
export class Job {
  private constructor(private readonly content: Chunk<Entry>) {
    Object.freeze(this);
  }

  static statement(prompt: Prompt): Job {
    const job = new Job(empty());
    return job.statement(prompt);
  }

  static shellCommand(command: Command): Job {
    const job = new Job(empty());
    return job.shellCommand(command);
  }

  static job(child: Job): Job {
    const job = new Job(empty());
    return job.job(child);
  }

  statement(prompt: Prompt): Job {
    const statement: Statement = {
      kind: TaskKind.Statement,
      prompt: this.snapshotPrompt(prompt),
    };
    return this.append(Object.freeze(statement));
  }

  shellCommand(command: Command): Job {
    const shellCommand: ShellCommand = {
      kind: TaskKind.ShellCommand,
      cwd: command.cwd,
      script: command.script,
    };
    return this.append(Object.freeze(shellCommand));
  }

  job(child: Job): Job {
    return this.append(child);
  }

  size(): number {
    return size(this.content);
  }

  private append(entry: Entry): Job {
    return new Job(append(this.content, entry));
  }

  private snapshotPrompt(prompt: Prompt): Prompt {
    switch (prompt.kind) {
      case PromptKind.Statement: {
        const snapshot: PromptStatement = { ...prompt };
        return Object.freeze(snapshot);
      }
      case PromptKind.BulletList:
        return this.snapshotBulletList(prompt);
      case PromptKind.EnclosedList: {
        const items = EffectArray.map(prompt.items, (item) =>
          this.snapshotBulletList(item),
        );
        const snapshot: EnclosedList = {
          ...prompt,
          items: Object.freeze(items),
        };
        return Object.freeze(snapshot);
      }
    }
  }

  private snapshotBulletList(list: BulletList): BulletList {
    const snapshot: BulletList = {
      ...list,
      items: Object.freeze(EffectArray.copy(list.items)),
    };
    return Object.freeze(snapshot);
  }
}
