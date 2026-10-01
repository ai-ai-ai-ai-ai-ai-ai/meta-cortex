import { type Job, WorkingDirectory } from "@meta-cortex/lace";

const receipt: Job = {
  stages: {
    overview: {
      Statement: {
        prompt: {
          BulletList: {
            label: "Neural Lace",
            items: {
              contextLanguage:
                "Neural Lace defines the typed declaration language for Cortex context.",
              contextSubjects:
                "Context includes architecture, specifications, rules, agent instructions, skills, and practices.",
              readAsText:
                "Agents read declarations as text, just as they read Markdown.",
              entryPointReading:
                "Read this entry point as context; do not import it to execute code.",
              authoringOwner: "Context Engineering owns receipt authoring.",
              markdownAuthority:
                "Other existing Cortex Markdown instructions remain authoritative.",
            },
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
                items: {
                  followContract:
                    "Follow the core ownership, receipt contract, and validation context below.",
                  resolvePaths:
                    "Resolve prose paths in this entry point from the Cortex library root: cortex/ in this repository or .meta-cortex/ in an installed project.",
                },
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
                    items: {
                      readModel:
                        "Read lace/src/ts/lace.ts before authoring receipts.",
                      modelVocabulary:
                        "The model contains the WorkingDirectory enum, types, interfaces, and the inert PromptStatement.content authoring helper.",
                      readonlyJobs:
                        "Job is a readonly interface; receipts use plain objects with nested stages.",
                      jobComposition: "Job groups other Jobs and tasks.",
                      hierarchyMetaphor:
                        "Jobs represent directories; tasks represent files.",
                      stageUnion: "Stage is the union of Job and Task.",
                      taskVariants:
                        "Task is the closed union of mapped Statement and ShellCommand variants around plain payloads.",
                      promptVariants:
                        "Prompt is the closed union of mapped PromptStatement and BulletList variants around plain payloads.",
                    },
                  },
                },
              },
            },
            contextPlacement: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Context placement",
                    items: {
                      assignedScope:
                        "Keep receipt edits within the assigned Cortex context scope.",
                      subjectLocation:
                        "Write subject receipts beside their owning context, outside lace/.",
                      selfDescription:
                        "This lace/AGENTS.ts entry point describes Lace using its own vocabulary.",
                      inertCore:
                        "The model and validation implementation contain no operational context declarations.",
                    },
                  },
                },
              },
            },
            coreChanges: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Core changes",
                    items: {
                      existingVocabulary:
                        "Use the existing core vocabulary and run the existing checks.",
                      explicitCoreAssignment:
                        "Change the core only under an explicit user assignment to change it.",
                      failedReceiptScope:
                        "A receipt that fails validation does not grant that assignment.",
                      correctReceipt:
                        "Correct an invalid receipt using the existing vocabulary.",
                      missingCapability:
                        "Report a missing capability when that vocabulary cannot express the assigned context.",
                    },
                  },
                },
              },
            },
            ownershipExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: {
                      prohibited: {
                        BulletList: {
                          label: "Prohibited",
                          items: {
                            unauthorizedCoreEdit:
                              "While assigned to write a context receipt, add a task kind because the receipt fails compilation.",
                          },
                        },
                      },
                      preferred: {
                        BulletList: {
                          label: "Preferred",
                          items: {
                            useExistingDeclarations:
                              "Read the model, then write the assigned receipt beside its context using existing declarations.",
                            unchangedChecks: "Run the unchanged checks.",
                            separateCoreRequest:
                              "Report an unsupported capability for a separate core assignment.",
                          },
                        },
                      },
                    },
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
                    items: {
                      importJob: "Import the Job type from @meta-cortex/lace.",
                      descriptiveNames:
                        "Follow teams/ai-team/docs/lace-architecture.md#stage-names when naming Job stages and short descriptive bullet keys.",
                      modelImports:
                        "Import the required types, WorkingDirectory for commands, and the PromptStatement value helper from @meta-cortex/lace when needed.",
                      rootDeclaration:
                        "Declare the root as const receipt: Job = { stages: { context: context } } and export default receipt.",
                      explicitStageKeys:
                        "Give each stage an explicit unique identifier or string literal key and a nested Job, mapped Task, or static Job reference value.",
                      nestedJobs:
                        "Nest child Jobs directly in named stages maps to show hierarchy; use source declaration order when reading context.",
                      taskPayloads:
                        "Use { Statement: { prompt } } for a prose task or { ShellCommand: { cwd, script } } for a shell task; Task wraps plain readonly concrete payloads.",
                    },
                  },
                },
              },
            },
            readonlyDeclarations: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Readonly declarations",
                    items: {
                      stageOrder:
                        "Job.stages is a readonly Readonly<Record<string, Stage>> map; prefer nonnumeric names because JavaScript enumerates integer-like object keys in ascending order before other string keys.",
                      readonlyVariants:
                        "Job fields, concrete payload fields, and outer Task and Prompt variant properties are readonly; each variant excludes its opposite and rejects hybrids.",
                      nonemptyMaps:
                        "Jobs contain nonempty literal named stage maps; BulletLists contain nonempty literal named item maps.",
                      literalHierarchy:
                        "Create hierarchy with literal named maps; the exact PromptStatement.content literal helper in standalone Statement.prompt is the sole call exception, and constructors remain invalid.",
                      readonlyAccess:
                        "TypeScript checks readonly access; these declarations do not freeze JavaScript objects at runtime.",
                      importConstruction:
                        "Read declarations as context; importing a receipt invokes its helper calls to construct plain objects, but never runs declared shell commands.",
                    },
                  },
                },
              },
            },
            readonlyExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: {
                      prohibited: {
                        BulletList: {
                          label: "Prohibited",
                          items: {
                            stageMutation:
                              "Mutate receipt stages or hide their hierarchy behind calls.",
                          },
                        },
                      },
                      preferred: {
                        BulletList: {
                          label: "Preferred",
                          items: {
                            typedReadonly:
                              "Keep declaration objects readonly through the Job type.",
                            staticComposition:
                              "Compose context receipts with imports and nested object literals.",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            taskAndPromptShapes: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: {
                      statement: {
                        BulletList: {
                          label: "Statement",
                          items: {
                            statementShape:
                              "Declare a task as { Statement: { prompt } } with a structured mapped Prompt; the concrete Statement payload contains only prompt.",
                            statementMeaning:
                              "A statement can explain architecture, describe a specification, state a rule, or give an instruction.",
                            requiredWording:
                              "Its wording conveys whether it describes context or requires an action.",
                          },
                        },
                      },
                      promptStatement: {
                        BulletList: {
                          label: "Prompt statement",
                          items: {
                            standaloneHelper:
                              "Use PromptStatement.content with one nonblank string or noninterpolated template literal only for a standalone Statement.prompt; the helper returns { PromptStatement: { content } }; plain mapped prompt objects remain supported.",
                          },
                        },
                      },
                      bulletList: {
                        BulletList: {
                          label: "Bullet list",
                          items: {
                            namedItems:
                              "Declare { BulletList: { label, items } } with an optional literal label and a nonempty literal items map of text or mapped BulletList groups.",
                            literalText:
                              "Give each text bullet a short descriptive key and nonblank literal string or noninterpolated template value; keep one independent fact or rule in each item.",
                          },
                        },
                      },
                      nestedBulletList: {
                        BulletList: {
                          label: "Nested bullet list",
                          items: {
                            recursiveGroups:
                              "Nest mapped BulletList groups within named items recursively; arrays, raw payloads, PromptStatement wrappers, and helper calls are invalid item values.",
                            optionalLabels:
                              "Use the same plain BulletList payload inside mapped Prompt variants for standalone lists and nested groups; labels are optional.",
                            meaningfulGroups:
                              "Use groups when their bullets belong to a named subject or example.",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            promptExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: {
                      prohibited: {
                        BulletList: {
                          label: "Prohibited",
                          items: {
                            hiddenStructure:
                              "Hide independent rules in one long paragraph or encode bullet structure inside a raw string.",
                          },
                        },
                      },
                      preferred: {
                        BulletList: {
                          label: "Preferred",
                          items: {
                            parallelRules:
                              "Use a BulletList for parallel rules.",
                            labelledGroups:
                              "Nest BulletLists for labelled groups with their own bullets.",
                            explicitActions:
                              "State required actions explicitly in the prompt's wording.",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            shellCommands: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Shell commands",
                    items: {
                      shellShape:
                        "Declare a shell task as { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: 'bun run check' } }; the wrapper and payload fields are readonly.",
                      commandRoots:
                        "Choose WorkingDirectory.ProjectRoot or WorkingDirectory.LibraryRoot.",
                      resolveRoots:
                        "Resolve both roots before running commands through the host's shell tool.",
                      inertCommands:
                        "Compilation never executes declared commands.",
                    },
                  },
                },
              },
            },
            composition: {
              Statement: {
                prompt: {
                  BulletList: {
                    label: "Composition",
                    items: {
                      declarationGrammar:
                        "Limit receipts to static imports, typed const Job objects, literal prompts and commands, the exact PromptStatement.content literal helper only in standalone Statement.prompt, and the default receipt export; do not use empty maps, stage arrays, computed keys, spreads, methods, or nonliteral stage maps.",
                      importedContext:
                        "Import another receipt's default Job to reuse its context.",
                      readImportedSource:
                        "Read the imported source before applying its context.",
                      relativeImports:
                        "Relative imports resolve from the receipt file.",
                      literalConditions:
                        "Express conditions and context selection in literal prompt content.",
                    },
                  },
                },
              },
            },
            compositionExamples: {
              Statement: {
                prompt: {
                  BulletList: {
                    items: {
                      prohibited: {
                        BulletList: {
                          label: "Prohibited",
                          items: {
                            invalidRoot:
                              "Default-export a raw array or task, use a constructor, or call an implementation helper.",
                          },
                        },
                      },
                      preferred: {
                        BulletList: {
                          label: "Preferred",
                          items: {
                            nestedReceipt:
                              "Declare const receipt: Job = { stages: { context: context, checks: { stages: { compile: compile, verify: verify } } } }; then export default receipt.",
                            authoringExample:
                              "See teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts for an authoring example.",
                            architectureReference:
                              "See teams/ai-team/docs/lace-architecture.md for the declaration grammar and validation limits.",
                          },
                        },
                      },
                    },
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
                    items: {
                      compilerCheck:
                        "Use the compiler check while editing receipts.",
                      completeVerification:
                        "Run complete verification before reporting that a receipt passes all Lace checks.",
                      libraryRoot:
                        "Run these commands from the Cortex library root.",
                    },
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
                    items: {
                      prohibited: {
                        BulletList: {
                          label: "Prohibited",
                          items: {
                            incompleteClaim:
                              "Report that all Lace checks pass after running only check.",
                          },
                        },
                      },
                      preferred: {
                        BulletList: {
                          label: "Preferred",
                          items: {
                            compileOnly:
                              "Use check for compilation without emitting files.",
                            fullChecks:
                              "Run verify for formatting, declaration grammar, types, and contract tests.",
                            commandEvidence:
                              "Neither check executes declared commands or proves their success in a consuming project.",
                          },
                        },
                      },
                    },
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
                items: {
                  contextOnly:
                    "Do not use Lace as a coding-agent API or an application workflow.",
                  inertModel:
                    "Do not put subject context declarations in the model or validation implementation.",
                  subjectReceipts:
                    "Lace's own context entry point is lace/AGENTS.ts; subject receipts belong with their owning context outside lace/.",
                  protectedCore:
                    "Do not change core types, grammar, tests, scripts, configuration, or the core entry point during receipt authoring.",
                  explicitAssignment:
                    "Core changes require an explicit user assignment to change the core.",
                },
              },
            },
          },
        },
        scopeExamples: {
          Statement: {
            prompt: {
              BulletList: {
                items: {
                  prohibited: {
                    BulletList: {
                      label: "Prohibited",
                      items: {
                        weakenCore:
                          "Add an application callback to the model or weaken lint to make a context receipt pass.",
                      },
                    },
                  },
                  preferred: {
                    BulletList: {
                      label: "Preferred",
                      items: {
                        assignedFiles:
                          "Keep receipt work within the assigned Cortex context files.",
                        authorizedCoreWork:
                          "When explicitly assigned to change Lace, edit the relevant core files and verify the project.",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default receipt;
