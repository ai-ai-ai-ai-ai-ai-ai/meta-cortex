import type { Job } from "./job.ts";

/**
 * Neural Lace is the declaration language for Cortex context files.
 * Context authors use it for instructions, skills, and practices read by agents.
 * Read receipt files as text; do not import them to execute code.
 * Each receipt exports one Job. Jobs are directories; tasks are files.
 * The immutable Job builder groups tasks and other jobs.
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
  Statement = "statement",
  BulletList = "bullet-list",
  EnclosedList = "enclosed-list",
}

export interface PromptStatement {
  readonly kind: PromptKind.Statement;
  readonly content: string;
}

export interface BulletList {
  readonly kind: PromptKind.BulletList;
  readonly label: string;
  readonly items: readonly string[];
}

export interface EnclosedList {
  readonly kind: PromptKind.EnclosedList;
  readonly items: readonly BulletList[];
}

export type Prompt = PromptStatement | BulletList | EnclosedList;

/** Literal Cortex prose: explanations, specifications, rules, and instructions. */
export interface Statement {
  readonly kind: TaskKind.Statement;
  readonly prompt: Prompt;
}

/** Declared shell text. Compilation and importing never run this command. */
export interface Command {
  readonly cwd: WorkingDirectory;
  readonly script: string;
}

export interface ShellCommand extends Command {
  readonly kind: TaskKind.ShellCommand;
}

/** The task vocabulary is closed: no callbacks, scripts-as-functions, or flags. */
export type Task = Statement | ShellCommand;

/** Each entry is either a nested job or a task. */
export type Entry = Job | Task;
