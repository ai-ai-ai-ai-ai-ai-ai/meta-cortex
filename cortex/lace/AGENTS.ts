import { Job, PromptKind, WorkingDirectory } from "./src/ts/lace.ts";

export default Job.statement({
  kind: PromptKind.BulletList,
  items: [
    "Neural Lace defines the typed declaration language for Cortex context.",
    "Context includes architecture, specifications, rules, agent instructions, skills, and practices.",
    "Agents read declarations as text, just as they read Markdown.",
    "Read this entry point as context; do not import it to execute code.",
    "Context Engineering owns receipt authoring.",
    "Other existing Cortex Markdown instructions remain authoritative.",
  ],
})
  .job(
    Job.statement({
      kind: PromptKind.BulletList,
      items: [
        "Required actions: follow the core ownership, receipt contract, and validation context below.",
        "Resolve prose paths in this entry point from the Cortex library root: cortex/ in this repository or .meta-cortex/ in an installed project.",
      ],
    })
      .job(
        Job.statement({
          kind: PromptKind.BulletList,
          items: [
            "Core ownership: read lace/src/ts/lace.ts before authoring receipts.",
            "Job groups other Jobs and tasks.",
            "Jobs represent directories; tasks represent files.",
            "Entry is the union of Job and Task.",
            "Task is the union of Statement and ShellCommand.",
            "Prompt is the union of PromptStatement, BulletList, and EnclosedList.",
          ],
        })
          .statement({
            kind: PromptKind.BulletList,
            items: [
              "Keep receipt edits within the assigned Cortex context scope.",
              "Write subject receipts beside their owning context, outside lace/.",
              "This lace/AGENTS.ts entry point describes Lace using its own vocabulary.",
              "The model and validation implementation remain ordinary code without operational context declarations.",
            ],
          })
          .statement({
            kind: PromptKind.BulletList,
            items: [
              "Use the existing core vocabulary and run the existing checks.",
              "Change the core only under an explicit user assignment to change it.",
              "A receipt that fails validation does not grant that assignment.",
              "Correct an invalid receipt using the existing vocabulary.",
              "Report a missing capability when that vocabulary cannot express the assigned context.",
            ],
          })
          .statement({
            kind: PromptKind.EnclosedList,
            items: [
              {
                label: "Prohibited",
                items: [
                  "While assigned to write a context receipt, add a task kind because the receipt fails compilation.",
                ],
              },
              {
                label: "Preferred",
                items: [
                  "Read the model, then write the assigned receipt beside its context using existing declarations.",
                  "Run the unchanged checks.",
                  "Report an unsupported capability for a separate core assignment.",
                ],
              },
            ],
          }),
      )
      .job(
        Job.statement({
          kind: PromptKind.BulletList,
          items: [
            "Receipt contract: import Job and the required enums from lace/src/ts/lace.ts.",
            "Default-export a Job builder chain that starts with a statement, command, or child Job.",
            "Use statement(prompt), shellCommand(command), and job(child) to extend the tree.",
            "Nest imported Jobs, local const Jobs, or inline builder chains with job(child).",
            "Each builder checks its input type and returns a new immutable Job.",
          ],
        })
          .statement({
            kind: PromptKind.BulletList,
            items: [
              "Job owns an immutable Effect Chunk in a private readonly field.",
              "Builders snapshot prompts and commands without modifying source objects or arrays.",
              "size() counts immediate entries.",
              "Each statement, shellCommand, or job call returns a new Job without changing the original.",
              "TypeScript checks private access; no method exposes stored entries or prompt references.",
              "The constructor is private; receipts use only the three builder methods.",
            ],
          })
          .statement({
            kind: PromptKind.EnclosedList,
            items: [
              {
                label: "Prohibited",
                items: ["Read job.entries or mutate a Job."],
              },
              {
                label: "Preferred",
                items: [
                  "Keep immutable operations inside Job.",
                  "Compose context receipts with imports and Job builder chains.",
                ],
              },
            ],
          })
          .statement({
            kind: PromptKind.EnclosedList,
            items: [
              {
                label: "Statement",
                items: [
                  "Pass a structured prompt to statement(prompt); the builder supplies TaskKind.Statement.",
                  "A statement can explain architecture, describe a specification, state a rule, or give an instruction.",
                  "Its wording conveys whether it describes context or requires an action.",
                ],
              },
              {
                label: "Prompt statement",
                items: [
                  "Declare kind: PromptKind.Statement and literal content for a prompt statement.",
                ],
              },
              {
                label: "Bullet list",
                items: [
                  "Declare kind: PromptKind.BulletList and a nonempty items array of literal strings.",
                  "Keep one independent fact or rule in each item.",
                ],
              },
              {
                label: "Enclosed list",
                items: [
                  "Declare kind: PromptKind.EnclosedList and a nonempty items array of labelled groups.",
                  "Each group has a literal label and a nonempty items array of literal strings.",
                  "Use groups when their bullets belong to a named subject or example.",
                ],
              },
            ],
          })
          .statement({
            kind: PromptKind.EnclosedList,
            items: [
              {
                label: "Prohibited",
                items: [
                  "Hide independent rules in one long paragraph or encode bullet structure inside a raw string.",
                ],
              },
              {
                label: "Preferred",
                items: [
                  "Use a BulletList for parallel rules.",
                  "Use an EnclosedList for labelled groups with their own bullets.",
                  "State required actions explicitly in the prompt's wording.",
                ],
              },
            ],
          })
          .statement({
            kind: PromptKind.BulletList,
            items: [
              "Pass literal script and cwd to shellCommand(command); the builder supplies TaskKind.ShellCommand.",
              "Choose WorkingDirectory.ProjectRoot or WorkingDirectory.LibraryRoot.",
              "Resolve both roots before running commands through the host's shell tool.",
              "Compilation never executes declared commands.",
            ],
          })
          .statement({
            kind: PromptKind.BulletList,
            items: [
              "Limit receipts to static imports, const Job bindings, builder chains, and literal prompts and commands.",
              "Import another receipt's default Job to reuse its context.",
              "Read the imported source before applying its context.",
              "Relative imports resolve from the receipt file.",
              "Express conditions and context selection in literal prompt content.",
            ],
          })
          .statement({
            kind: PromptKind.EnclosedList,
            items: [
              {
                label: "Prohibited",
                items: [
                  "Default-export a raw array or task, use the private constructor, or call an implementation helper.",
                ],
              },
              {
                label: "Preferred",
                items: [
                  "Export Job.job(context).job(Job.job(compile).job(verify)) using statically imported Jobs.",
                  "See teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts for an authoring example.",
                  "See teams/ai-team/docs/lace-architecture.md for the declaration grammar and validation limits.",
                ],
              },
            ],
          }),
      )
      .job(
        Job.statement({
          kind: PromptKind.BulletList,
          items: [
            "Validation: use the compiler check while editing receipts.",
            "Run complete verification before reporting that a receipt passes all Lace checks.",
            "Run these commands from the Cortex library root.",
          ],
        })
          .shellCommand({
            cwd: WorkingDirectory.LibraryRoot,
            script: "bun run --filter @meta-cortex/lace check",
          })
          .shellCommand({
            cwd: WorkingDirectory.LibraryRoot,
            script: "bun run --filter @meta-cortex/lace verify",
          })
          .statement({
            kind: PromptKind.EnclosedList,
            items: [
              {
                label: "Prohibited",
                items: [
                  "Report that all Lace checks pass after running only check.",
                ],
              },
              {
                label: "Preferred",
                items: [
                  "Use check for compilation without emitting files.",
                  "Run verify for formatting, declaration grammar, types, and contract tests.",
                  "Neither check executes declared commands or proves their success in a consuming project.",
                ],
              },
            ],
          }),
      ),
  )
  .job(
    Job.statement({
      kind: PromptKind.BulletList,
      items: [
        "Prohibited actions: do not use Lace as a coding-agent API or an application workflow.",
        "Do not put subject context declarations in the model or validation implementation.",
        "Lace's own context entry point is lace/AGENTS.ts; subject receipts belong with their owning context outside lace/.",
        "Do not change core types, grammar, tests, scripts, configuration, or the core entry point during receipt authoring.",
        "Core changes require an explicit user assignment to change the core.",
      ],
    }).statement({
      kind: PromptKind.EnclosedList,
      items: [
        {
          label: "Prohibited",
          items: [
            "Add an application callback to the model or weaken lint to make a context receipt pass.",
          ],
        },
        {
          label: "Preferred",
          items: [
            "Keep receipt work within the assigned Cortex context files.",
            "When explicitly assigned to change Lace, edit the relevant core files and verify the project.",
          ],
        },
      ],
    }),
  );
