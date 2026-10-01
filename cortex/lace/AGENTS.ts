import {
  type Job,
  TaskKind,
  PromptKind,
  WorkingDirectory,
} from "./src/ts/lace.ts";

const receipt: Job = {
  entries: [
    {
      kind: TaskKind.Statement,
      prompt: {
        kind: PromptKind.BulletList,
        label: "Neural Lace",
        items: [
          "Neural Lace defines the typed declaration language for Cortex context.",
          "Context includes architecture, specifications, rules, agent instructions, skills, and practices.",
          "Agents read declarations as text, just as they read Markdown.",
          "Read this entry point as context; do not import it to execute code.",
          "Context Engineering owns receipt authoring.",
          "Other existing Cortex Markdown instructions remain authoritative.",
        ],
      },
    },
    {
      entries: [
        {
          kind: TaskKind.Statement,
          prompt: {
            kind: PromptKind.BulletList,
            label: "Required actions",
            items: [
              "Follow the core ownership, receipt contract, and validation context below.",
              "Resolve prose paths in this entry point from the Cortex library root: cortex/ in this repository or .meta-cortex/ in an installed project.",
            ],
          },
        },
        {
          entries: [
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Core ownership",
                items: [
                  "Read lace/src/ts/lace.ts before authoring receipts.",
                  "The model contains only enums, types, and interfaces.",
                  "Job is a readonly interface; receipts use plain objects with nested entries.",
                  "Job groups other Jobs and tasks.",
                  "Jobs represent directories; tasks represent files.",
                  "Entry is the union of Job and Task.",
                  "Task is the union of Statement and ShellCommand.",
                  "Prompt is the union of PromptStatement, BulletList, and EnclosedList.",
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Context placement",
                items: [
                  "Keep receipt edits within the assigned Cortex context scope.",
                  "Write subject receipts beside their owning context, outside lace/.",
                  "This lace/AGENTS.ts entry point describes Lace using its own vocabulary.",
                  "The model and validation implementation contain no operational context declarations.",
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Core changes",
                items: [
                  "Use the existing core vocabulary and run the existing checks.",
                  "Change the core only under an explicit user assignment to change it.",
                  "A receipt that fails validation does not grant that assignment.",
                  "Correct an invalid receipt using the existing vocabulary.",
                  "Report a missing capability when that vocabulary cannot express the assigned context.",
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.EnclosedList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      "While assigned to write a context receipt, add a task kind because the receipt fails compilation.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      "Read the model, then write the assigned receipt beside its context using existing declarations.",
                      "Run the unchanged checks.",
                      "Report an unsupported capability for a separate core assignment.",
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          entries: [
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Receipt contract",
                items: [
                  "Import the Job type from lace/src/ts/lace.ts.",
                  "Import the required enums and types from lace/src/ts/lace.ts.",
                  "Declare the root as const receipt: Job = { entries: [...] } and export default receipt.",
                  "Declare each entry as a nested Job object, Statement object, ShellCommand object, or imported Job.",
                  "Nest child Jobs directly in entries arrays to show the hierarchy through indentation.",
                  "Use TaskKind.Statement with prompt, or TaskKind.ShellCommand with cwd and script.",
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Readonly declarations",
                items: [
                  "Job.entries is a readonly array of Entry values.",
                  "Job, task, and prompt fields are readonly in the model.",
                  "Jobs and prompt lists contain at least one entry or item under the declaration grammar.",
                  "Create hierarchy with literal objects and arrays; do not use methods or constructors.",
                  "TypeScript checks readonly access; these declarations do not freeze JavaScript objects at runtime.",
                  "Read declarations as context rather than importing them to execute code.",
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.EnclosedList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      "Mutate receipt entries or hide their hierarchy behind calls.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      "Keep declaration objects readonly through the Job type.",
                      "Compose context receipts with imports and nested object literals.",
                    ],
                  },
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.EnclosedList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Statement",
                    items: [
                      "Declare a Statement with kind: TaskKind.Statement and a structured prompt.",
                      "A statement can explain architecture, describe a specification, state a rule, or give an instruction.",
                      "Its wording conveys whether it describes context or requires an action.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Prompt statement",
                    items: [
                      "Declare kind: PromptKind.Statement and literal content for a prompt statement.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Bullet list",
                    items: [
                      "Declare kind: PromptKind.BulletList, a literal label, and a nonempty items array of literal strings.",
                      "Keep one independent fact or rule in each item.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Enclosed list",
                    items: [
                      "Declare kind: PromptKind.EnclosedList and a nonempty items array of BulletLists.",
                      "Use the same BulletList shape for standalone lists and enclosed groups.",
                      "Use groups when their bullets belong to a named subject or example.",
                    ],
                  },
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.EnclosedList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      "Hide independent rules in one long paragraph or encode bullet structure inside a raw string.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      "Use a BulletList for parallel rules.",
                      "Use an EnclosedList for labelled groups with their own bullets.",
                      "State required actions explicitly in the prompt's wording.",
                    ],
                  },
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Shell commands",
                items: [
                  "Declare a ShellCommand with kind: TaskKind.ShellCommand, literal script, and cwd.",
                  "Choose WorkingDirectory.ProjectRoot or WorkingDirectory.LibraryRoot.",
                  "Resolve both roots before running commands through the host's shell tool.",
                  "Compilation never executes declared commands.",
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Composition",
                items: [
                  "Limit receipts to static imports, typed const Job objects, literal prompts and commands, and the default receipt export.",
                  "Import another receipt's default Job to reuse its context.",
                  "Read the imported source before applying its context.",
                  "Relative imports resolve from the receipt file.",
                  "Express conditions and context selection in literal prompt content.",
                ],
              },
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.EnclosedList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      "Default-export a raw array or task, use a constructor, or call an implementation helper.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      "Declare const receipt: Job = { entries: [context, { entries: [compile, verify] }] }; then export default receipt.",
                      "See teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts for an authoring example.",
                      "See teams/ai-team/docs/lace-architecture.md for the declaration grammar and validation limits.",
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          entries: [
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Validation",
                items: [
                  "Use the compiler check while editing receipts.",
                  "Run complete verification before reporting that a receipt passes all Lace checks.",
                  "Run these commands from the Cortex library root.",
                ],
              },
            },
            {
              kind: TaskKind.ShellCommand,
              cwd: WorkingDirectory.LibraryRoot,
              script: "bun run --filter @meta-cortex/lace check",
            },
            {
              kind: TaskKind.ShellCommand,
              cwd: WorkingDirectory.LibraryRoot,
              script: "bun run --filter @meta-cortex/lace verify",
            },
            {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.EnclosedList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      "Report that all Lace checks pass after running only check.",
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      "Use check for compilation without emitting files.",
                      "Run verify for formatting, declaration grammar, types, and contract tests.",
                      "Neither check executes declared commands or proves their success in a consuming project.",
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      entries: [
        {
          kind: TaskKind.Statement,
          prompt: {
            kind: PromptKind.BulletList,
            label: "Prohibited actions",
            items: [
              "Do not use Lace as a coding-agent API or an application workflow.",
              "Do not put subject context declarations in the model or validation implementation.",
              "Lace's own context entry point is lace/AGENTS.ts; subject receipts belong with their owning context outside lace/.",
              "Do not change core types, grammar, tests, scripts, configuration, or the core entry point during receipt authoring.",
              "Core changes require an explicit user assignment to change the core.",
            ],
          },
        },
        {
          kind: TaskKind.Statement,
          prompt: {
            kind: PromptKind.EnclosedList,
            items: [
              {
                kind: PromptKind.BulletList,
                label: "Prohibited",
                items: [
                  "Add an application callback to the model or weaken lint to make a context receipt pass.",
                ],
              },
              {
                kind: PromptKind.BulletList,
                label: "Preferred",
                items: [
                  "Keep receipt work within the assigned Cortex context files.",
                  "When explicitly assigned to change Lace, edit the relevant core files and verify the project.",
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};

export default receipt;
