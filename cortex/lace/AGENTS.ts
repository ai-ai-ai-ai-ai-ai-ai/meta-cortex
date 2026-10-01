import { type Job, PromptStatement, WorkingDirectory } from "./src/ts/lace.ts";

const receipt: Job = {
  stages: {
    overview: {
      Statement: {
        prompt: {
          BulletList: {
            label: "Neural Lace",
            items: [
              PromptStatement.content(
                "Neural Lace defines the typed declaration language for Cortex context.",
              ),
              PromptStatement.content(
                "Context includes architecture, specifications, rules, agent instructions, skills, and practices.",
              ),
              PromptStatement.content(
                "Agents read declarations as text, just as they read Markdown.",
              ),
              PromptStatement.content(
                "Read this entry point as context; do not import it to execute code.",
              ),
              PromptStatement.content(
                "Context Engineering owns receipt authoring.",
              ),
              PromptStatement.content(
                "Other existing Cortex Markdown instructions remain authoritative.",
              ),
            ],
          },
        },
      },
    },
    requiredActions: {
      stages: {
        orientation: {
          Statement: {
            prompt: {
              BulletList: {
                label: "Required actions",
                items: [
                  PromptStatement.content(
                    "Follow the core ownership, receipt contract, and validation context below.",
                  ),
                  PromptStatement.content(
                    "Resolve prose paths in this entry point from the Cortex library root: cortex/ in this repository or .meta-cortex/ in an installed project.",
                  ),
                ],
              },
            },
          },
        },
        coreOwnership: {
          stages: {
            vocabulary: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Core ownership",
                    items: [
                      PromptStatement.content(
                        "Read lace/src/ts/lace.ts before authoring receipts.",
                      ),
                      PromptStatement.content(
                        "The model contains the WorkingDirectory enum, types, interfaces, and the inert PromptStatement.content authoring helper.",
                      ),
                      PromptStatement.content(
                        "Job is a readonly interface; receipts use plain objects with nested stages.",
                      ),
                      PromptStatement.content(
                        "Job groups other Jobs and tasks.",
                      ),
                      PromptStatement.content(
                        "Jobs represent directories; tasks represent files.",
                      ),
                      PromptStatement.content(
                        "Stage is the union of Job and Task.",
                      ),
                      PromptStatement.content(
                        "Task is the union of Statement and ShellCommand.",
                      ),
                      PromptStatement.content(
                        "Prompt is the union of PromptStatement and BulletList.",
                      ),
                    ],
                  },
                },
              },
            },
            contextPlacement: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Context placement",
                    items: [
                      PromptStatement.content(
                        "Keep receipt edits within the assigned Cortex context scope.",
                      ),
                      PromptStatement.content(
                        "Write subject receipts beside their owning context, outside lace/.",
                      ),
                      PromptStatement.content(
                        "This lace/AGENTS.ts entry point describes Lace using its own vocabulary.",
                      ),
                      PromptStatement.content(
                        "The model and validation implementation contain no operational context declarations.",
                      ),
                    ],
                  },
                },
              },
            },
            coreChanges: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Core changes",
                    items: [
                      PromptStatement.content(
                        "Use the existing core vocabulary and run the existing checks.",
                      ),
                      PromptStatement.content(
                        "Change the core only under an explicit user assignment to change it.",
                      ),
                      PromptStatement.content(
                        "A receipt that fails validation does not grant that assignment.",
                      ),
                      PromptStatement.content(
                        "Correct an invalid receipt using the existing vocabulary.",
                      ),
                      PromptStatement.content(
                        "Report a missing capability when that vocabulary cannot express the assigned context.",
                      ),
                    ],
                  },
                },
              },
            },
            ownershipExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: [
                      {
                        BulletList: {
                          label: "Prohibited",
                          items: [
                            PromptStatement.content(
                              "While assigned to write a context receipt, add a task kind because the receipt fails compilation.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Preferred",
                          items: [
                            PromptStatement.content(
                              "Read the model, then write the assigned receipt beside its context using existing declarations.",
                            ),
                            PromptStatement.content(
                              "Run the unchanged checks.",
                            ),
                            PromptStatement.content(
                              "Report an unsupported capability for a separate core assignment.",
                            ),
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        receiptAuthoring: {
          stages: {
            receiptContract: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Receipt contract",
                    items: [
                      PromptStatement.content(
                        "Import the Job type from lace/src/ts/lace.ts.",
                      ),
                      PromptStatement.content(
                        "Follow teams/ai-team/docs/lace-architecture.md#stage-names when naming Job stages.",
                      ),
                      PromptStatement.content(
                        "Import the required types, WorkingDirectory for commands, and the PromptStatement value helper from lace/src/ts/lace.ts.",
                      ),
                      PromptStatement.content(
                        "Declare the root as const receipt: Job = { stages: { context: context } } and export default receipt.",
                      ),
                      PromptStatement.content(
                        "Give each stage an explicit unique identifier or string literal key and a nested Job, mapped Task, or static Job reference value.",
                      ),
                      PromptStatement.content(
                        "Nest child Jobs directly in named stages maps to show hierarchy; use source declaration order when reading context.",
                      ),
                      PromptStatement.content(
                        "Use { Statement: { prompt } } for a prose task or { ShellCommand: { cwd, script } } for a shell task; Task wraps plain readonly concrete payloads.",
                      ),
                    ],
                  },
                },
              },
            },
            readonlyDeclarations: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Readonly declarations",
                    items: [
                      PromptStatement.content(
                        "Job.stages is a readonly Readonly<Record<string, Stage>> map; prefer nonnumeric names because JavaScript enumerates integer-like object keys in ascending order before other string keys.",
                      ),
                      PromptStatement.content(
                        "Job fields, concrete payload fields, and outer Task and Prompt variant properties are readonly; each variant excludes its opposite and rejects hybrids.",
                      ),
                      PromptStatement.content(
                        "Jobs contain nonempty plain literal named entry maps; prompt lists contain nonempty literal item arrays.",
                      ),
                      PromptStatement.content(
                        "Create hierarchy with literal objects and arrays; the exact PromptStatement.content literal helper is the sole call exception, and constructors remain invalid.",
                      ),
                      PromptStatement.content(
                        "TypeScript checks readonly access; these declarations do not freeze JavaScript objects at runtime.",
                      ),
                      PromptStatement.content(
                        "Read declarations as context; importing a receipt invokes its helper calls to construct plain objects, but never runs declared shell commands.",
                      ),
                    ],
                  },
                },
              },
            },
            readonlyExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: [
                      {
                        BulletList: {
                          label: "Prohibited",
                          items: [
                            PromptStatement.content(
                              "Mutate receipt stages or hide their hierarchy behind calls.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Preferred",
                          items: [
                            PromptStatement.content(
                              "Keep declaration objects readonly through the Job type.",
                            ),
                            PromptStatement.content(
                              "Compose context receipts with imports and nested object literals.",
                            ),
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
            taskAndPromptShapes: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: [
                      {
                        BulletList: {
                          label: "Statement",
                          items: [
                            PromptStatement.content(
                              "Declare a task as { Statement: { prompt } } with a structured mapped Prompt; the concrete Statement payload contains only prompt.",
                            ),
                            PromptStatement.content(
                              "A statement can explain architecture, describe a specification, state a rule, or give an instruction.",
                            ),
                            PromptStatement.content(
                              "Its wording conveys whether it describes context or requires an action.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Prompt statement",
                          items: [
                            PromptStatement.content(
                              "Use PromptStatement.content with one nonblank string or noninterpolated template literal for a prompt statement; the helper returns { PromptStatement: { content } }; plain mapped prompt objects remain supported.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Bullet list",
                          items: [
                            PromptStatement.content(
                              "Declare { BulletList: { label, items } } with an optional literal label and a nonempty literal items array of mapped Prompt objects.",
                            ),
                            PromptStatement.content(
                              "Declare each text bullet with PromptStatement.content and literal content; keep one independent fact or rule in each item.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Nested bullet list",
                          items: [
                            PromptStatement.content(
                              "Nest mapped BulletList Prompt objects within items to group related prompts recursively.",
                            ),
                            PromptStatement.content(
                              "Use the same plain BulletList payload inside mapped Prompt variants for standalone lists and nested groups; labels are optional.",
                            ),
                            PromptStatement.content(
                              "Use groups when their bullets belong to a named subject or example.",
                            ),
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
            promptExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: [
                      {
                        BulletList: {
                          label: "Prohibited",
                          items: [
                            PromptStatement.content(
                              "Hide independent rules in one long paragraph or encode bullet structure inside a raw string.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Preferred",
                          items: [
                            PromptStatement.content(
                              "Use a BulletList for parallel rules.",
                            ),
                            PromptStatement.content(
                              "Nest BulletLists for labelled groups with their own bullets.",
                            ),
                            PromptStatement.content(
                              "State required actions explicitly in the prompt's wording.",
                            ),
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
            shellCommands: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Shell commands",
                    items: [
                      PromptStatement.content(
                        "Declare a shell task as { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: 'bun run check' } }; the wrapper and payload fields are readonly.",
                      ),
                      PromptStatement.content(
                        "Choose WorkingDirectory.ProjectRoot or WorkingDirectory.LibraryRoot.",
                      ),
                      PromptStatement.content(
                        "Resolve both roots before running commands through the host's shell tool.",
                      ),
                      PromptStatement.content(
                        "Compilation never executes declared commands.",
                      ),
                    ],
                  },
                },
              },
            },
            composition: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Composition",
                    items: [
                      PromptStatement.content(
                        "Limit receipts to static imports, typed const Job objects, literal prompts and commands, the exact PromptStatement.content literal helper in prompt or bullet-item positions, and the default receipt export; do not use empty maps, stage arrays, computed keys, spreads, methods, or nonliteral stage maps.",
                      ),
                      PromptStatement.content(
                        "Import another receipt's default Job to reuse its context.",
                      ),
                      PromptStatement.content(
                        "Read the imported source before applying its context.",
                      ),
                      PromptStatement.content(
                        "Relative imports resolve from the receipt file.",
                      ),
                      PromptStatement.content(
                        "Express conditions and context selection in literal prompt content.",
                      ),
                    ],
                  },
                },
              },
            },
            compositionExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: [
                      {
                        BulletList: {
                          label: "Prohibited",
                          items: [
                            PromptStatement.content(
                              "Default-export a raw array or task, use a constructor, or call an implementation helper.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Preferred",
                          items: [
                            PromptStatement.content(
                              "Declare const receipt: Job = { stages: { context: context, checks: { stages: { compile: compile, verify: verify } } } }; then export default receipt.",
                            ),
                            PromptStatement.content(
                              "See teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts for an authoring example.",
                            ),
                            PromptStatement.content(
                              "See teams/ai-team/docs/lace-architecture.md for the declaration grammar and validation limits.",
                            ),
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        validation: {
          stages: {
            validationGuidance: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Validation",
                    items: [
                      PromptStatement.content(
                        "Use the compiler check while editing receipts.",
                      ),
                      PromptStatement.content(
                        "Run complete verification before reporting that a receipt passes all Lace checks.",
                      ),
                      PromptStatement.content(
                        "Run these commands from the Cortex library root.",
                      ),
                    ],
                  },
                },
              },
            },
            compile: {
              ShellCommand: {
                cwd: WorkingDirectory.LibraryRoot,
                script: "bun run --filter @meta-cortex/lace check",
              },
            },
            verify: {
              ShellCommand: {
                cwd: WorkingDirectory.LibraryRoot,
                script: "bun run --filter @meta-cortex/lace verify",
              },
            },
            validationExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: [
                      {
                        BulletList: {
                          label: "Prohibited",
                          items: [
                            PromptStatement.content(
                              "Report that all Lace checks pass after running only check.",
                            ),
                          ],
                        },
                      },
                      {
                        BulletList: {
                          label: "Preferred",
                          items: [
                            PromptStatement.content(
                              "Use check for compilation without emitting files.",
                            ),
                            PromptStatement.content(
                              "Run verify for formatting, declaration grammar, types, and contract tests.",
                            ),
                            PromptStatement.content(
                              "Neither check executes declared commands or proves their success in a consuming project.",
                            ),
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    prohibitedActions: {
      stages: {
        scopeRestrictions: {
          Statement: {
            prompt: {
              BulletList: {
                label: "Prohibited actions",
                items: [
                  PromptStatement.content(
                    "Do not use Lace as a coding-agent API or an application workflow.",
                  ),
                  PromptStatement.content(
                    "Do not put subject context declarations in the model or validation implementation.",
                  ),
                  PromptStatement.content(
                    "Lace's own context entry point is lace/AGENTS.ts; subject receipts belong with their owning context outside lace/.",
                  ),
                  PromptStatement.content(
                    "Do not change core types, grammar, tests, scripts, configuration, or the core entry point during receipt authoring.",
                  ),
                  PromptStatement.content(
                    "Core changes require an explicit user assignment to change the core.",
                  ),
                ],
              },
            },
          },
        },
        scopeExamples: {
          Statement: {
            prompt: {
              BulletList: {
                items: [
                  {
                    BulletList: {
                      label: "Prohibited",
                      items: [
                        PromptStatement.content(
                          "Add an application callback to the model or weaken lint to make a context receipt pass.",
                        ),
                      ],
                    },
                  },
                  {
                    BulletList: {
                      label: "Preferred",
                      items: [
                        PromptStatement.content(
                          "Keep receipt work within the assigned Cortex context files.",
                        ),
                        PromptStatement.content(
                          "When explicitly assigned to change Lace, edit the relevant core files and verify the project.",
                        ),
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};

export default receipt;
