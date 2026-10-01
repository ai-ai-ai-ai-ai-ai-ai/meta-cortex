import { type Job, type Stage, WorkingDirectory } from "@meta-cortex/lace";
export const overview: Stage = {
  spec: {
    contextLanguage:
      "Neural Lace defines the typed declaration language for Cortex context.",
    contextSubjects:
      "Context includes architecture, specifications, rules, agent instructions, skills, and practices.",
    readAsText: "Agents read declarations as text, just as they read Markdown.",
    entryPointReading:
      "Read this entry point as context; do not import it to execute code.",
    authoringOwner: "Context Engineering owns receipt authoring.",
    markdownAuthority:
      "Other existing Cortex Markdown instructions remain authoritative.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const orientation: Stage = {
  spec: {},
  Required: {
    statements: {
      followContract:
        "Follow the core ownership, receipt contract, and validation context below.",
      resolvePaths:
        "Resolve prose paths in this entry point from the Cortex library root: cortex/ in this repository or .meta-cortex/ in an installed project.",
    },
  },
  Prohibited: {
    statements: {},
  },
};
export const coreOwnershipVocabulary: Stage = {
  spec: {
    readModel: "Read lace/src/ts/lace.ts before authoring receipts.",
    modelVocabulary:
      "The model contains the WorkingDirectory enum and readonly Job, Stage, Statement, Required, Prohibited, and ShellCommand contracts.",
    readonlyJobs:
      "Job is a readonly interface; receipts use plain objects with named Stage sections.",
    jobComposition: "Job groups Stage sections in its stages map.",
    sectionPurpose:
      "Each Stage separates specification, required actions, and prohibited actions.",
    fixedStageFields:
      "Stage has mandatory spec, Required, and Prohibited fields.",
    statementForms:
      "Statement is a literal string or an object with mandatory content and ShellCommand.",
    normativeSections:
      "Required and Prohibited each contain a named statements map.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const coreOwnershipContextPlacement: Stage = {
  spec: {
    assignedScope:
      "Keep receipt edits within the assigned Cortex context scope.",
    subjectLocation:
      "Write subject receipts beside their owning context, outside lace/.",
    selfDescription:
      "This lace/AGENTS.ts entry point describes Lace using its own vocabulary.",
    inertCore:
      "The model and validation implementation contain no operational context declarations.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const coreOwnershipCoreChanges: Stage = {
  spec: {
    existingVocabulary:
      "Use the existing core vocabulary and run the existing checks.",
    explicitCoreAssignment:
      "Change the core only under an explicit user assignment to change it.",
    failedReceiptScope:
      "A receipt that fails validation does not grant that assignment.",
    correctReceipt: "Correct an invalid receipt using the existing vocabulary.",
    missingCapability:
      "Report a missing capability when that vocabulary cannot express the assigned context.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const coreOwnershipOwnershipExamples: Stage = {
  spec: {},
  Required: {
    statements: {
      requiredUseExistingDeclarations:
        "Read the model, then write the assigned receipt beside its context using existing declarations.",
      requiredUnchangedChecks: "Run the unchanged checks.",
      requiredSeparateCoreRequest:
        "Report an unsupported capability for a separate core assignment.",
    },
  },
  Prohibited: {
    statements: {
      prohibitedUnauthorizedCoreEdit:
        "While assigned to write a context receipt, add a model field because the receipt fails compilation.",
    },
  },
};
export const receiptAuthoringReceiptContract: Stage = {
  spec: {
    importJob: "Import the Job type from @meta-cortex/lace.",
    descriptiveNames:
      "Follow teams/ai-team/docs/lace-architecture.md#stage-names when naming Job stages and short descriptive spec and statement keys.",
    modelImports:
      "Import the required types and WorkingDirectory for commands from @meta-cortex/lace.",
    rootDeclaration:
      "Declare the root as const receipt: Job = { stages: { context: context } } and export default receipt.",
    explicitStageKeys:
      "Give each stage an explicit unique identifier or string literal key and a literal Stage or static Stage reference value.",
    fixedSections:
      "Keep context in fixed Stage sections; use source declaration order when reading named maps.",
    statementPayloads:
      "Use a literal string for prose or { content, ShellCommand: { cwd, script } } for a command statement.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const receiptAuthoringReadonlyDeclarations: Stage = {
  spec: {
    stageOrder:
      "Job.stages is a readonly Readonly<Record<string, Stage>> map; prefer nonnumeric names because JavaScript enumerates integer-like object keys in ascending order before other string keys.",
    readonlyFields:
      "Job and Stage fields, statement maps, and structured command fields are readonly.",
    emptyMaps:
      "All stages, spec, and statements maps are literal named objects and may be empty.",
    literalSections:
      "Compose fixed sections with literal named maps and static Stage or Statement references; calls and constructors are invalid.",
    readonlyAccess:
      "TypeScript checks readonly access; these declarations do not freeze JavaScript objects at runtime.",
    importConstruction:
      "Read declarations as context; importing a receipt constructs plain data and never runs declared shell commands.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const receiptAuthoringReadonlyExamples: Stage = {
  spec: {},
  Required: {
    statements: {
      requiredTypedReadonly:
        "Keep declaration objects readonly through the Job type.",
      requiredStaticComposition:
        "Compose Stage and Statement declarations with static imports and literal objects.",
    },
  },
  Prohibited: {
    statements: {
      prohibitedStageMutation:
        "Mutate receipt sections or hide context behind calls.",
    },
  },
};
export const receiptAuthoringStatementShapes: Stage = {
  spec: {
    literalStatementShape:
      "Declare prose as a literal string in spec or a Required or Prohibited statements map.",
    statementMeaning:
      "A statement can explain architecture, describe a specification, state a rule, or give an instruction.",
    statementRequiredWording:
      "Its wording conveys whether it describes context or requires an action.",
    literalStatementText:
      "Use one nonblank literal string or noninterpolated template for each prose statement.",
    specificationStatements:
      "Declare Stage.spec as a named Statement map for specifications and explanatory context.",
    shortStatementKeys:
      "Give each statement a short descriptive key and nonblank literal string or noninterpolated template value; keep one independent fact or rule in each statement.",
    normativeStatements:
      "Put mandatory actions in Required.statements and forbidden actions in Prohibited.statements; do not nest Job objects or groups.",
    mandatoryStageFields:
      "Include spec, Required, and Prohibited in every Stage even when their maps are empty.",
    purposeNamedSections:
      "Use purpose-named Stage sections for related statements; follow teams/ai-team/docs/lace-architecture.md#normative-categories for their placement.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const receiptAuthoringStatementExamples: Stage = {
  spec: {},
  Required: {
    statements: {
      requiredParallelRules: "Use named statements for parallel rules.",
      requiredSubjectSections:
        "Use separate purpose-named Stages for different subjects.",
      requiredExplicitActions:
        "State required actions explicitly in the statement's wording.",
    },
  },
  Prohibited: {
    statements: {
      prohibitedHiddenStructure:
        "Hide independent rules in one long paragraph under a single statement name.",
    },
  },
};
export const receiptAuthoringShellCommands: Stage = {
  spec: {
    shellShape:
      "Declare a command statement as { content: 'Check receipts.', ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: 'bun run check' } }; every field is readonly.",
    commandRoots:
      "Choose WorkingDirectory.ProjectRoot or WorkingDirectory.LibraryRoot.",
    resolveRoots:
      "Resolve both roots before running commands through the host's shell tool.",
    inertCommands: "Compilation never executes declared commands.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const receiptAuthoringComposition: Stage = {
  spec: {
    declarationGrammar:
      "Limit receipts to static imports, typed const Job, Stage, and Statement declarations, literal text and commands, and a default Job receipt export. Maps may be empty; arrays, computed keys, spreads, methods, calls, and nonliteral map shapes are invalid.",
    importedContext:
      "Import named typed Stage and Statement declarations from another receipt to reuse its context.",
    readImportedSource: "Read the imported source before applying its context.",
    relativeImports: "Relative imports resolve from the receipt file.",
    literalConditions:
      "Express conditions and context selection in literal statement text.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const receiptAuthoringCompositionExamples: Stage = {
  spec: {},
  Required: {
    statements: {
      requiredStaticStages:
        "Declare const receipt: Job = { stages: { context: context, compileReceipt: compileReceipt, verifyReceipt: verifyReceipt } }; then export default receipt.",
      requiredAuthoringExample:
        "See teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts for an authoring example.",
      requiredArchitectureReference:
        "See teams/ai-team/docs/lace-architecture.md for the declaration grammar and validation limits.",
    },
  },
  Prohibited: {
    statements: {
      prohibitedInvalidRoot:
        "Default-export a raw array or Stage, use a constructor, or call an implementation function.",
    },
  },
};
export const validationValidationGuidance: Stage = {
  spec: {
    compilerCheck: "Use the compiler check while editing receipts.",
    completeVerification:
      "Run complete verification before reporting that a receipt passes all Lace checks.",
    libraryRoot: "Run these commands from the Cortex library root.",
  },
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {},
  },
};
export const validationCompile: Stage = {
  spec: {},
  Required: {
    statements: {
      compile: {
        content: "Compile Lace receipts.",
        ShellCommand: {
          cwd: WorkingDirectory.LibraryRoot,
          script: "bun run --filter @meta-cortex/lace check",
        },
      },
    },
  },
  Prohibited: {
    statements: {},
  },
};
export const validationVerify: Stage = {
  spec: {},
  Required: {
    statements: {
      verify: {
        content: "Verify Lace receipts.",
        ShellCommand: {
          cwd: WorkingDirectory.LibraryRoot,
          script: "bun run --filter @meta-cortex/lace verify",
        },
      },
    },
  },
  Prohibited: {
    statements: {},
  },
};
export const validationValidationExamples: Stage = {
  spec: {},
  Required: {
    statements: {
      requiredCompileOnly: "Use check for compilation without emitting files.",
      requiredFullChecks:
        "Run verify for formatting, declaration grammar, types, and contract tests.",
      requiredCommandEvidence:
        "Neither check executes declared commands or proves their success in a consuming project.",
    },
  },
  Prohibited: {
    statements: {
      prohibitedIncompleteClaim:
        "Report that all Lace checks pass after running only check.",
    },
  },
};
export const scopeRestrictions: Stage = {
  spec: {},
  Required: {
    statements: {},
  },
  Prohibited: {
    statements: {
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
};
export const scopeExamples: Stage = {
  spec: {},
  Required: {
    statements: {
      requiredAssignedFiles:
        "Keep receipt work within the assigned Cortex context files.",
      requiredAuthorizedCoreWork:
        "When explicitly assigned to change Lace, edit the relevant core files and verify the project.",
    },
  },
  Prohibited: {
    statements: {
      prohibitedWeakenCore:
        "Add an application callback to the model or weaken lint to make a context receipt pass.",
    },
  },
};
const receipt: Job = {
  stages: {
    overview: overview,
    orientation: orientation,
    coreOwnershipVocabulary: coreOwnershipVocabulary,
    coreOwnershipContextPlacement: coreOwnershipContextPlacement,
    coreOwnershipCoreChanges: coreOwnershipCoreChanges,
    coreOwnershipOwnershipExamples: coreOwnershipOwnershipExamples,
    receiptAuthoringReceiptContract: receiptAuthoringReceiptContract,
    receiptAuthoringReadonlyDeclarations: receiptAuthoringReadonlyDeclarations,
    receiptAuthoringReadonlyExamples: receiptAuthoringReadonlyExamples,
    receiptAuthoringStatementShapes: receiptAuthoringStatementShapes,
    receiptAuthoringStatementExamples: receiptAuthoringStatementExamples,
    receiptAuthoringShellCommands: receiptAuthoringShellCommands,
    receiptAuthoringComposition: receiptAuthoringComposition,
    receiptAuthoringCompositionExamples: receiptAuthoringCompositionExamples,
    validationValidationGuidance: validationValidationGuidance,
    validationCompile: validationCompile,
    validationVerify: validationVerify,
    validationValidationExamples: validationValidationExamples,
    scopeRestrictions: scopeRestrictions,
    scopeExamples: scopeExamples,
  },
};
export default receipt;
