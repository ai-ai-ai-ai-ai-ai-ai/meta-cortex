import {
  type Job,
  TaskKind,
  PromptKind,
  WorkingDirectory,
} from "./src/ts/lace.ts";

const receipt: Job = {
  entries: {
    step1: {
      kind: TaskKind.Statement,
      prompt: {
        kind: PromptKind.BulletList,
        label: "Neural Lace",
        items: [
          {
            kind: PromptKind.Statement,
            content:
              "Neural Lace defines the typed declaration language for Cortex context.",
          },
          {
            kind: PromptKind.Statement,
            content:
              "Context includes architecture, specifications, rules, agent instructions, skills, and practices.",
          },
          {
            kind: PromptKind.Statement,
            content:
              "Agents read declarations as text, just as they read Markdown.",
          },
          {
            kind: PromptKind.Statement,
            content:
              "Read this entry point as context; do not import it to execute code.",
          },
          {
            kind: PromptKind.Statement,
            content: "Context Engineering owns receipt authoring.",
          },
          {
            kind: PromptKind.Statement,
            content:
              "Other existing Cortex Markdown instructions remain authoritative.",
          },
        ],
      },
    },
    step2: {
      entries: {
        step1: {
          kind: TaskKind.Statement,
          prompt: {
            kind: PromptKind.BulletList,
            label: "Required actions",
            items: [
              {
                kind: PromptKind.Statement,
                content:
                  "Follow the core ownership, receipt contract, and validation context below.",
              },
              {
                kind: PromptKind.Statement,
                content:
                  "Resolve prose paths in this entry point from the Cortex library root: cortex/ in this repository or .meta-cortex/ in an installed project.",
              },
            ],
          },
        },
        step2: {
          entries: {
            step1: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Core ownership",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Read lace/src/ts/lace.ts before authoring receipts.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "The model contains only enums, types, and interfaces.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Job is a readonly interface; receipts use plain objects with nested entries.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content: "Job groups other Jobs and tasks.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Jobs represent directories; tasks represent files.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content: "Entry is the union of Job and Task.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content: "Task is the union of Statement and ShellCommand.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Prompt is the union of PromptStatement and BulletList.",
                  },
                ],
              },
            },
            step2: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Context placement",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Keep receipt edits within the assigned Cortex context scope.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Write subject receipts beside their owning context, outside lace/.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "This lace/AGENTS.ts entry point describes Lace using its own vocabulary.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "The model and validation implementation contain no operational context declarations.",
                  },
                ],
              },
            },
            step3: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Core changes",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Use the existing core vocabulary and run the existing checks.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Change the core only under an explicit user assignment to change it.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "A receipt that fails validation does not grant that assignment.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Correct an invalid receipt using the existing vocabulary.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Report a missing capability when that vocabulary cannot express the assigned context.",
                  },
                ],
              },
            },
            step4: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "While assigned to write a context receipt, add a task kind because the receipt fails compilation.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Read the model, then write the assigned receipt beside its context using existing declarations.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content: "Run the unchanged checks.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Report an unsupported capability for a separate core assignment.",
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        step3: {
          entries: {
            step1: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Receipt contract",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content: "Import the Job type from lace/src/ts/lace.ts.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Import the required enums and types from lace/src/ts/lace.ts.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Declare the root as const receipt: Job = { entries: { context: context } } and export default receipt.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Give each entry an explicit unique identifier or string literal key and a nested Job, Statement, ShellCommand, or static Job reference value.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Nest child Jobs directly in named entries maps to show hierarchy; use source declaration order when reading context.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Use TaskKind.Statement with prompt, or TaskKind.ShellCommand with cwd and script.",
                  },
                ],
              },
            },
            step2: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Readonly declarations",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Job.entries is a readonly Readonly<Record<string, Entry>> map; prefer nonnumeric names because JavaScript enumerates integer-like object keys in ascending order before other string keys.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Job, task, and prompt fields are readonly in the model.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Jobs contain nonempty plain literal named entry maps; prompt lists contain nonempty literal item arrays.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Create hierarchy with literal objects and arrays; do not use methods or constructors.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "TypeScript checks readonly access; these declarations do not freeze JavaScript objects at runtime.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Read declarations as context rather than importing them to execute code.",
                  },
                ],
              },
            },
            step3: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Mutate receipt entries or hide their hierarchy behind calls.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Keep declaration objects readonly through the Job type.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Compose context receipts with imports and nested object literals.",
                      },
                    ],
                  },
                ],
              },
            },
            step4: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Statement",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Declare a Statement with kind: TaskKind.Statement and a structured prompt.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "A statement can explain architecture, describe a specification, state a rule, or give an instruction.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Its wording conveys whether it describes context or requires an action.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Prompt statement",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Declare kind: PromptKind.Statement and literal content for a prompt statement.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Bullet list",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Declare kind: PromptKind.BulletList, an optional literal label, and a nonempty literal items array of structured Prompt objects.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Declare each text bullet as kind: PromptKind.Statement with literal content; keep one independent fact or rule in each item.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Nested bullet list",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Nest BulletList objects within items to group related prompts recursively.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Use the same BulletList shape for standalone lists and nested groups; labels are optional.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Use groups when their bullets belong to a named subject or example.",
                      },
                    ],
                  },
                ],
              },
            },
            step5: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Hide independent rules in one long paragraph or encode bullet structure inside a raw string.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content: "Use a BulletList for parallel rules.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Nest BulletLists for labelled groups with their own bullets.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "State required actions explicitly in the prompt's wording.",
                      },
                    ],
                  },
                ],
              },
            },
            step6: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Shell commands",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Declare a ShellCommand with kind: TaskKind.ShellCommand, literal script, and cwd.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Choose WorkingDirectory.ProjectRoot or WorkingDirectory.LibraryRoot.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Resolve both roots before running commands through the host's shell tool.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content: "Compilation never executes declared commands.",
                  },
                ],
              },
            },
            step7: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Composition",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Limit receipts to static imports, typed const Job objects, literal prompts and commands, and the default receipt export; do not use empty maps, entry arrays, computed keys, spreads, methods, or nonliteral entry maps.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Import another receipt's default Job to reuse its context.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Read the imported source before applying its context.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content: "Relative imports resolve from the receipt file.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Express conditions and context selection in literal prompt content.",
                  },
                ],
              },
            },
            step8: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Default-export a raw array or task, use a constructor, or call an implementation helper.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Declare const receipt: Job = { entries: { context: context, checks: { entries: { compile: compile, verify: verify } } } }; then export default receipt.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "See teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts for an authoring example.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "See teams/ai-team/docs/lace-architecture.md for the declaration grammar and validation limits.",
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        step4: {
          entries: {
            step1: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                label: "Validation",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content: "Use the compiler check while editing receipts.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Run complete verification before reporting that a receipt passes all Lace checks.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content: "Run these commands from the Cortex library root.",
                  },
                ],
              },
            },
            step2: {
              kind: TaskKind.ShellCommand,
              cwd: WorkingDirectory.LibraryRoot,
              script: "bun run --filter @meta-cortex/lace check",
            },
            step3: {
              kind: TaskKind.ShellCommand,
              cwd: WorkingDirectory.LibraryRoot,
              script: "bun run --filter @meta-cortex/lace verify",
            },
            step4: {
              kind: TaskKind.Statement,
              prompt: {
                kind: PromptKind.BulletList,
                items: [
                  {
                    kind: PromptKind.BulletList,
                    label: "Prohibited",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Report that all Lace checks pass after running only check.",
                      },
                    ],
                  },
                  {
                    kind: PromptKind.BulletList,
                    label: "Preferred",
                    items: [
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Use check for compilation without emitting files.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Run verify for formatting, declaration grammar, types, and contract tests.",
                      },
                      {
                        kind: PromptKind.Statement,
                        content:
                          "Neither check executes declared commands or proves their success in a consuming project.",
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    step3: {
      entries: {
        step1: {
          kind: TaskKind.Statement,
          prompt: {
            kind: PromptKind.BulletList,
            label: "Prohibited actions",
            items: [
              {
                kind: PromptKind.Statement,
                content:
                  "Do not use Lace as a coding-agent API or an application workflow.",
              },
              {
                kind: PromptKind.Statement,
                content:
                  "Do not put subject context declarations in the model or validation implementation.",
              },
              {
                kind: PromptKind.Statement,
                content:
                  "Lace's own context entry point is lace/AGENTS.ts; subject receipts belong with their owning context outside lace/.",
              },
              {
                kind: PromptKind.Statement,
                content:
                  "Do not change core types, grammar, tests, scripts, configuration, or the core entry point during receipt authoring.",
              },
              {
                kind: PromptKind.Statement,
                content:
                  "Core changes require an explicit user assignment to change the core.",
              },
            ],
          },
        },
        step2: {
          kind: TaskKind.Statement,
          prompt: {
            kind: PromptKind.BulletList,
            items: [
              {
                kind: PromptKind.BulletList,
                label: "Prohibited",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Add an application callback to the model or weaken lint to make a context receipt pass.",
                  },
                ],
              },
              {
                kind: PromptKind.BulletList,
                label: "Preferred",
                items: [
                  {
                    kind: PromptKind.Statement,
                    content:
                      "Keep receipt work within the assigned Cortex context files.",
                  },
                  {
                    kind: PromptKind.Statement,
                    content:
                      "When explicitly assigned to change Lace, edit the relevant core files and verify the project.",
                  },
                ],
              },
            ],
          },
        },
      },
    },
  },
};

export default receipt;
