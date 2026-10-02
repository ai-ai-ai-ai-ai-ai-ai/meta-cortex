// Generated from the canonical Rust schema by AJV standalone.
"use strict";
exports.reply = validate20;
const schema31 = {
  $id: "dashboard-reply",
  $ref: "#/$defs/DesktopReply",
  $defs: {
    AgentId: {
      description: "An agent role scoped to its owning Cortex team.",
      oneOf: [
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/GizmoAgent" },
            team: { const: "Gizmo", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/DevelopmentAgent" },
            team: { const: "Development", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/AiAgent" },
            team: { const: "Ai", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/SecurityAgent" },
            team: { const: "Security", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/SreAgent" },
            team: { const: "Sre", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/DeliveryAgent" },
            team: { const: "Delivery", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
      ],
    },
    AiAgent: { enum: ["TechWriter"], type: "string" },
    Assignment: {
      additionalProperties: false,
      properties: {
        agent: { $ref: "#/$defs/AgentId" },
        attempt: { format: "int64", type: "integer" },
        expires_at: { format: "int64", type: "integer" },
        phase: { $ref: "#/$defs/Phase" },
      },
      required: ["agent", "attempt", "expires_at", "phase"],
      type: "object",
    },
    Check: {
      additionalProperties: false,
      properties: {
        command: { $ref: "#/$defs/Note" },
        evidence: { $ref: "#/$defs/Note" },
        outcome: { $ref: "#/$defs/CheckOutcome" },
      },
      required: ["command", "outcome", "evidence"],
      type: "object",
    },
    CheckOutcome: { enum: ["passed", "failed", "not_run"], type: "string" },
    Checkpoint: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "unrecorded", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            commit: { type: "string" },
            kind: { const: "git", type: "string" },
          },
          required: ["kind", "commit"],
          type: "object",
        },
      ],
    },
    DashboardView: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "Features", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            feature: { type: "string" },
            kind: { const: "Tasks", type: "string" },
          },
          required: ["kind", "feature"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "Task", type: "string" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "History", type: "string" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query"],
          type: "object",
        },
      ],
    },
    DeliveryAgent: { enum: ["IntegrationAgent", "PrAgent"], type: "string" },
    DesktopContent: {
      oneOf: [
        {
          properties: {
            kind: { const: "Features", type: "string" },
            value: { $ref: "#/$defs/Page" },
          },
          required: ["kind", "value"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Workflow", type: "string" },
            value: { $ref: "#/$defs/FeatureFlow" },
          },
          required: ["kind", "value"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Task", type: "string" },
            value: { $ref: "#/$defs/Task" },
          },
          required: ["kind", "value"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "History", type: "string" },
            value: { $ref: "#/$defs/Page3" },
          },
          required: ["kind", "value"],
          type: "object",
        },
      ],
    },
    DesktopFailure: {
      oneOf: [
        {
          properties: {
            kind: { const: "Ledger", type: "string" },
            message: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "message"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Runtime", type: "string" },
            message: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "message"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Native", type: "string" },
            message: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "message"],
          type: "object",
        },
      ],
    },
    DesktopRead: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "Initial", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "Features", type: "string" },
            page: { format: "uint32", minimum: 0, type: "integer" },
          },
          required: ["kind", "page"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            feature: { type: "string" },
            kind: { const: "Workflow", type: "string" },
            page: { format: "uint32", minimum: 0, type: "integer" },
          },
          required: ["kind", "feature", "page"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "Task", type: "string" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "History", type: "string" },
            page: { format: "uint32", minimum: 0, type: "integer" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query", "page"],
          type: "object",
        },
      ],
    },
    DesktopReply: {
      properties: {
        content: { $ref: "#/$defs/DesktopContent" },
        selection: { $ref: "#/$defs/DesktopSelection" },
      },
      required: ["selection", "content"],
      type: "object",
    },
    DesktopSelection: {
      properties: {
        page: { format: "uint32", minimum: 0, type: "integer" },
        view: { $ref: "#/$defs/DashboardView" },
      },
      required: ["view", "page"],
      type: "object",
    },
    DevelopmentAgent: {
      enum: [
        "RustDev",
        "RustRefactoring",
        "RustVerifier",
        "TypescriptDev",
        "WebDesigner",
      ],
      type: "string",
    },
    Event: {
      additionalProperties: false,
      properties: {
        actor: { $ref: "#/$defs/AgentId" },
        kind: { $ref: "#/$defs/EventKind" },
        note: { $ref: "#/$defs/Note" },
        task: { $ref: "#/$defs/Task" },
        version: { format: "int64", type: "integer" },
      },
      required: ["version", "kind", "actor", "note", "task"],
      type: "object",
    },
    EventKind: {
      enum: [
        "created",
        "claimed",
        "heartbeat",
        "progress",
        "checkpoint",
        "ready",
        "integrated",
        "requeued",
        "cancelled",
      ],
      type: "string",
    },
    Feature: {
      additionalProperties: false,
      properties: {
        branch: { type: "string" },
        id: { type: "string" },
        objective: { $ref: "#/$defs/Note" },
        version: { format: "int64", type: "integer" },
        worktree: { type: "string" },
      },
      required: ["version", "id", "objective", "branch", "worktree"],
      type: "object",
    },
    FeatureFlow: {
      properties: {
        counts: { items: { $ref: "#/$defs/FlowCount" }, type: "array" },
        feature: { $ref: "#/$defs/Feature" },
        observed_at: { format: "int64", type: "integer" },
        tasks: { $ref: "#/$defs/Page2" },
      },
      required: ["feature", "counts", "tasks", "observed_at"],
      type: "object",
    },
    FlowCount: {
      properties: {
        count: { format: "uint64", minimum: 0, type: "integer" },
        state: { $ref: "#/$defs/FlowState" },
      },
      required: ["state", "count"],
      type: "object",
    },
    FlowState: {
      enum: [
        "queued",
        "working",
        "blocked",
        "ready",
        "integrated",
        "cancelled",
      ],
      type: "string",
    },
    GizmoAgent: { enum: ["GizmoPrime", "Gizmo"], type: "string" },
    Milestone: {
      properties: {
        actor: { $ref: "#/$defs/AgentId" },
        at: { format: "int64", type: "integer" },
        attempt: { format: "int64", type: "integer" },
        kind: { $ref: "#/$defs/EventKind" },
        note: { $ref: "#/$defs/Note" },
        revision: { format: "int64", type: "integer" },
      },
      required: ["kind", "actor", "at", "revision", "attempt", "note"],
      type: "object",
    },
    Note: { type: "string" },
    Page: {
      description:
        "A page of at most 100 records. Each operation releases its connection before returning.",
      properties: {
        end: { $ref: "#/$defs/PageEnd" },
        records: { items: { $ref: "#/$defs/Feature" }, type: "array" },
      },
      required: ["records", "end"],
      type: "object",
    },
    Page2: {
      description:
        "A page of at most 100 records. Each operation releases its connection before returning.",
      properties: {
        end: { $ref: "#/$defs/PageEnd" },
        records: { items: { $ref: "#/$defs/TaskFlow" }, type: "array" },
      },
      required: ["records", "end"],
      type: "object",
    },
    Page3: {
      description:
        "A page of at most 100 records. Each operation releases its connection before returning.",
      properties: {
        end: { $ref: "#/$defs/PageEnd" },
        records: { items: { $ref: "#/$defs/Event" }, type: "array" },
      },
      required: ["records", "end"],
      type: "object",
    },
    PageEnd: { enum: ["Complete", "More"], type: "string" },
    Phase: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "working", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "blocked", type: "string" },
            reason: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "reason"],
          type: "object",
        },
      ],
    },
    Progress: {
      additionalProperties: false,
      properties: {
        checks: { items: { $ref: "#/$defs/Check" }, type: "array" },
        extensions: {
          additionalProperties: true,
          default: {},
          description:
            "Task-specific data only. Coordination never interprets these keys.",
          type: "object",
        },
        findings: { items: { $ref: "#/$defs/Note" }, type: "array" },
        next_steps: { items: { $ref: "#/$defs/Note" }, type: "array" },
        summary: { $ref: "#/$defs/Note" },
      },
      required: ["summary", "findings", "next_steps", "checks"],
      type: "object",
    },
    RecordedActor: {
      oneOf: [
        {
          properties: { kind: { const: "unrecorded", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          properties: {
            agent: { $ref: "#/$defs/AgentId" },
            kind: { const: "recorded", type: "string" },
          },
          required: ["kind", "agent"],
          type: "object",
        },
      ],
    },
    RecordedCommit: {
      properties: {
        actor: { $ref: "#/$defs/AgentId" },
        at: { format: "int64", type: "integer" },
        commit: { type: "string" },
        revision: { format: "int64", type: "integer" },
      },
      required: ["commit", "actor", "at", "revision"],
      type: "object",
    },
    SecurityAgent: { enum: ["SecurityAgent"], type: "string" },
    SreAgent: {
      enum: ["CicdAgent", "DockerSpecialist", "KubernetesSpecialist"],
      type: "string",
    },
    Task: {
      additionalProperties: false,
      properties: {
        acceptance: { items: { $ref: "#/$defs/Note" }, type: "array" },
        attempt: { format: "int64", type: "integer" },
        checkpoint: { $ref: "#/$defs/Checkpoint" },
        created_at: { format: "int64", type: "integer" },
        dependencies: { items: { type: "string" }, type: "array" },
        feature: { type: "string" },
        id: { type: "string" },
        last_progress: { format: "int64", type: "integer" },
        last_update: { format: "int64", type: "integer" },
        objective: { $ref: "#/$defs/Note" },
        progress: { $ref: "#/$defs/Progress" },
        revision: { format: "int64", type: "integer" },
        state: { $ref: "#/$defs/TaskState" },
        version: { format: "int64", type: "integer" },
        workspace: { $ref: "#/$defs/Workspace" },
      },
      required: [
        "version",
        "id",
        "feature",
        "objective",
        "acceptance",
        "dependencies",
        "workspace",
        "revision",
        "attempt",
        "state",
        "created_at",
        "last_update",
        "last_progress",
        "checkpoint",
        "progress",
      ],
      type: "object",
    },
    TaskFlow: {
      properties: {
        checkpoints: {
          items: { $ref: "#/$defs/RecordedCommit" },
          type: "array",
        },
        created_by: { $ref: "#/$defs/RecordedActor" },
        history_end: { $ref: "#/$defs/PageEnd" },
        integrations: {
          items: { $ref: "#/$defs/RecordedCommit" },
          type: "array",
        },
        milestones: { items: { $ref: "#/$defs/Milestone" }, type: "array" },
        task: { $ref: "#/$defs/Task" },
        worker: { $ref: "#/$defs/RecordedActor" },
      },
      required: [
        "task",
        "created_by",
        "worker",
        "checkpoints",
        "integrations",
        "milestones",
        "history_end",
      ],
      type: "object",
    },
    TaskQuery: {
      additionalProperties: false,
      properties: { feature: { type: "string" }, task: { type: "string" } },
      required: ["feature", "task"],
      type: "object",
    },
    TaskState: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "queued", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            assignment: { $ref: "#/$defs/Assignment" },
            kind: { const: "active", type: "string" },
          },
          required: ["kind", "assignment"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            agent: { $ref: "#/$defs/AgentId" },
            attempt: { format: "int64", type: "integer" },
            kind: { const: "ready", type: "string" },
          },
          required: ["kind", "agent", "attempt"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            commit: { type: "string" },
            kind: { const: "integrated", type: "string" },
          },
          required: ["kind", "commit"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "cancelled", type: "string" },
            reason: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "reason"],
          type: "object",
        },
      ],
    },
    Workspace: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "read_only", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            branch: { type: "string" },
            kind: { const: "git", type: "string" },
            path: { type: "string" },
          },
          required: ["kind", "branch", "path"],
          type: "object",
        },
      ],
    },
  },
};
const schema32 = {
  properties: {
    content: { $ref: "#/$defs/DesktopContent" },
    selection: { $ref: "#/$defs/DesktopSelection" },
  },
  required: ["selection", "content"],
  type: "object",
};
const schema33 = {
  oneOf: [
    {
      properties: {
        kind: { const: "Features", type: "string" },
        value: { $ref: "#/$defs/Page" },
      },
      required: ["kind", "value"],
      type: "object",
    },
    {
      properties: {
        kind: { const: "Workflow", type: "string" },
        value: { $ref: "#/$defs/FeatureFlow" },
      },
      required: ["kind", "value"],
      type: "object",
    },
    {
      properties: {
        kind: { const: "Task", type: "string" },
        value: { $ref: "#/$defs/Task" },
      },
      required: ["kind", "value"],
      type: "object",
    },
    {
      properties: {
        kind: { const: "History", type: "string" },
        value: { $ref: "#/$defs/Page3" },
      },
      required: ["kind", "value"],
      type: "object",
    },
  ],
};
const schema34 = {
  description:
    "A page of at most 100 records. Each operation releases its connection before returning.",
  properties: {
    end: { $ref: "#/$defs/PageEnd" },
    records: { items: { $ref: "#/$defs/Feature" }, type: "array" },
  },
  required: ["records", "end"],
  type: "object",
};
const schema35 = { enum: ["Complete", "More"], type: "string" };
const schema36 = {
  additionalProperties: false,
  properties: {
    branch: { type: "string" },
    id: { type: "string" },
    objective: { $ref: "#/$defs/Note" },
    version: { format: "int64", type: "integer" },
    worktree: { type: "string" },
  },
  required: ["version", "id", "objective", "branch", "worktree"],
  type: "object",
};
const schema37 = { type: "string" };
function validate24(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.version === undefined && (missing0 = "version")) ||
        (data.id === undefined && (missing0 = "id")) ||
        (data.objective === undefined && (missing0 = "objective")) ||
        (data.branch === undefined && (missing0 = "branch")) ||
        (data.worktree === undefined && (missing0 = "worktree"))
      ) {
        validate24.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "branch" ||
              key0 === "id" ||
              key0 === "objective" ||
              key0 === "version" ||
              key0 === "worktree"
            )
          ) {
            validate24.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.branch !== undefined) {
            const _errs2 = errors;
            if (typeof data.branch !== "string") {
              validate24.errors = [
                {
                  instancePath: instancePath + "/branch",
                  schemaPath: "#/properties/branch/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.id !== undefined) {
              const _errs4 = errors;
              if (typeof data.id !== "string") {
                validate24.errors = [
                  {
                    instancePath: instancePath + "/id",
                    schemaPath: "#/properties/id/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.objective !== undefined) {
                const _errs6 = errors;
                if (typeof data.objective !== "string") {
                  validate24.errors = [
                    {
                      instancePath: instancePath + "/objective",
                      schemaPath: "#/$defs/Note/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.version !== undefined) {
                  let data3 = data.version;
                  const _errs9 = errors;
                  if (
                    !(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))
                  ) {
                    validate24.errors = [
                      {
                        instancePath: instancePath + "/version",
                        schemaPath: "#/properties/version/type",
                        keyword: "type",
                        params: { type: "integer" },
                        message: "must be integer",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.worktree !== undefined) {
                    const _errs11 = errors;
                    if (typeof data.worktree !== "string") {
                      validate24.errors = [
                        {
                          instancePath: instancePath + "/worktree",
                          schemaPath: "#/properties/worktree/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate24.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate23(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.records === undefined && (missing0 = "records")) ||
        (data.end === undefined && (missing0 = "end"))
      ) {
        validate23.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.end !== undefined) {
          let data0 = data.end;
          const _errs1 = errors;
          if (typeof data0 !== "string") {
            validate23.errors = [
              {
                instancePath: instancePath + "/end",
                schemaPath: "#/$defs/PageEnd/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              },
            ];
            return false;
          }
          if (!(data0 === "Complete" || data0 === "More")) {
            validate23.errors = [
              {
                instancePath: instancePath + "/end",
                schemaPath: "#/$defs/PageEnd/enum",
                keyword: "enum",
                params: { allowedValues: schema35.enum },
                message: "must be equal to one of the allowed values",
              },
            ];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.records !== undefined) {
            let data1 = data.records;
            const _errs4 = errors;
            if (errors === _errs4) {
              if (Array.isArray(data1)) {
                var valid2 = true;
                const len0 = data1.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs6 = errors;
                  if (
                    !validate24(data1[i0], {
                      instancePath: instancePath + "/records/" + i0,
                      parentData: data1,
                      parentDataProperty: i0,
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate24.errors
                        : vErrors.concat(validate24.errors);
                    errors = vErrors.length;
                  }
                  var valid2 = _errs6 === errors;
                  if (!valid2) {
                    break;
                  }
                }
              } else {
                validate23.errors = [
                  {
                    instancePath: instancePath + "/records",
                    schemaPath: "#/properties/records/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
        }
      }
    } else {
      validate23.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = {
  props: { end: true, records: true },
  dynamicProps: false,
  dynamicItems: false,
};
const schema38 = {
  properties: {
    counts: { items: { $ref: "#/$defs/FlowCount" }, type: "array" },
    feature: { $ref: "#/$defs/Feature" },
    observed_at: { format: "int64", type: "integer" },
    tasks: { $ref: "#/$defs/Page2" },
  },
  required: ["feature", "counts", "tasks", "observed_at"],
  type: "object",
};
const schema39 = {
  properties: {
    count: { format: "uint64", minimum: 0, type: "integer" },
    state: { $ref: "#/$defs/FlowState" },
  },
  required: ["state", "count"],
  type: "object",
};
const schema40 = {
  enum: ["queued", "working", "blocked", "ready", "integrated", "cancelled"],
  type: "string",
};
function validate28(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.state === undefined && (missing0 = "state")) ||
        (data.count === undefined && (missing0 = "count"))
      ) {
        validate28.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.count !== undefined) {
          let data0 = data.count;
          const _errs1 = errors;
          if (!(typeof data0 == "number" && !(data0 % 1) && !isNaN(data0))) {
            validate28.errors = [
              {
                instancePath: instancePath + "/count",
                schemaPath: "#/properties/count/type",
                keyword: "type",
                params: { type: "integer" },
                message: "must be integer",
              },
            ];
            return false;
          }
          if (errors === _errs1) {
            if (typeof data0 == "number") {
              if (data0 < 0 || isNaN(data0)) {
                validate28.errors = [
                  {
                    instancePath: instancePath + "/count",
                    schemaPath: "#/properties/count/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  },
                ];
                return false;
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.state !== undefined) {
            let data1 = data.state;
            const _errs3 = errors;
            if (typeof data1 !== "string") {
              validate28.errors = [
                {
                  instancePath: instancePath + "/state",
                  schemaPath: "#/$defs/FlowState/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            if (
              !(
                data1 === "queued" ||
                data1 === "working" ||
                data1 === "blocked" ||
                data1 === "ready" ||
                data1 === "integrated" ||
                data1 === "cancelled"
              )
            ) {
              validate28.errors = [
                {
                  instancePath: instancePath + "/state",
                  schemaPath: "#/$defs/FlowState/enum",
                  keyword: "enum",
                  params: { allowedValues: schema40.enum },
                  message: "must be equal to one of the allowed values",
                },
              ];
              return false;
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
        }
      }
    } else {
      validate28.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate28.errors = vErrors;
  return errors === 0;
}
validate28.evaluated = {
  props: { count: true, state: true },
  dynamicProps: false,
  dynamicItems: false,
};
const schema41 = {
  description:
    "A page of at most 100 records. Each operation releases its connection before returning.",
  properties: {
    end: { $ref: "#/$defs/PageEnd" },
    records: { items: { $ref: "#/$defs/TaskFlow" }, type: "array" },
  },
  required: ["records", "end"],
  type: "object",
};
const schema43 = {
  properties: {
    checkpoints: { items: { $ref: "#/$defs/RecordedCommit" }, type: "array" },
    created_by: { $ref: "#/$defs/RecordedActor" },
    history_end: { $ref: "#/$defs/PageEnd" },
    integrations: { items: { $ref: "#/$defs/RecordedCommit" }, type: "array" },
    milestones: { items: { $ref: "#/$defs/Milestone" }, type: "array" },
    task: { $ref: "#/$defs/Task" },
    worker: { $ref: "#/$defs/RecordedActor" },
  },
  required: [
    "task",
    "created_by",
    "worker",
    "checkpoints",
    "integrations",
    "milestones",
    "history_end",
  ],
  type: "object",
};
const schema44 = {
  properties: {
    actor: { $ref: "#/$defs/AgentId" },
    at: { format: "int64", type: "integer" },
    commit: { type: "string" },
    revision: { format: "int64", type: "integer" },
  },
  required: ["commit", "actor", "at", "revision"],
  type: "object",
};
const schema45 = {
  description: "An agent role scoped to its owning Cortex team.",
  oneOf: [
    {
      additionalProperties: false,
      properties: {
        role: { $ref: "#/$defs/GizmoAgent" },
        team: { const: "Gizmo", type: "string" },
      },
      required: ["team", "role"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        role: { $ref: "#/$defs/DevelopmentAgent" },
        team: { const: "Development", type: "string" },
      },
      required: ["team", "role"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        role: { $ref: "#/$defs/AiAgent" },
        team: { const: "Ai", type: "string" },
      },
      required: ["team", "role"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        role: { $ref: "#/$defs/SecurityAgent" },
        team: { const: "Security", type: "string" },
      },
      required: ["team", "role"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        role: { $ref: "#/$defs/SreAgent" },
        team: { const: "Sre", type: "string" },
      },
      required: ["team", "role"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        role: { $ref: "#/$defs/DeliveryAgent" },
        team: { const: "Delivery", type: "string" },
      },
      required: ["team", "role"],
      type: "object",
    },
  ],
};
const schema46 = { enum: ["GizmoPrime", "Gizmo"], type: "string" };
const schema47 = {
  enum: [
    "RustDev",
    "RustRefactoring",
    "RustVerifier",
    "TypescriptDev",
    "WebDesigner",
  ],
  type: "string",
};
const schema48 = { enum: ["TechWriter"], type: "string" };
const schema49 = { enum: ["SecurityAgent"], type: "string" };
const schema50 = {
  enum: ["CicdAgent", "DockerSpecialist", "KubernetesSpecialist"],
  type: "string",
};
const schema51 = { enum: ["IntegrationAgent", "PrAgent"], type: "string" };
function validate34(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate34.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.team === undefined && (missing0 = "team")) ||
        (data.role === undefined && (missing0 = "role"))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        const _errs3 = errors;
        for (const key0 in data) {
          if (!(key0 === "role" || key0 === "team")) {
            const err1 = {
              instancePath,
              schemaPath: "#/oneOf/0/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
            break;
          }
        }
        if (_errs3 === errors) {
          if (data.role !== undefined) {
            let data0 = data.role;
            const _errs4 = errors;
            if (typeof data0 !== "string") {
              const err2 = {
                instancePath: instancePath + "/role",
                schemaPath: "#/$defs/GizmoAgent/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
            if (!(data0 === "GizmoPrime" || data0 === "Gizmo")) {
              const err3 = {
                instancePath: instancePath + "/role",
                schemaPath: "#/$defs/GizmoAgent/enum",
                keyword: "enum",
                params: { allowedValues: schema46.enum },
                message: "must be equal to one of the allowed values",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
            var valid1 = _errs4 === errors;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.team !== undefined) {
              let data1 = data.team;
              const _errs7 = errors;
              if (typeof data1 !== "string") {
                const err4 = {
                  instancePath: instancePath + "/team",
                  schemaPath: "#/oneOf/0/properties/team/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors++;
              }
              if ("Gizmo" !== data1) {
                const err5 = {
                  instancePath: instancePath + "/team",
                  schemaPath: "#/oneOf/0/properties/team/const",
                  keyword: "const",
                  params: { allowedValue: "Gizmo" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              }
              var valid1 = _errs7 === errors;
            } else {
              var valid1 = true;
            }
          }
        }
      }
    } else {
      const err6 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs9 = errors;
  if (errors === _errs9) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (
        (data.team === undefined && (missing1 = "team")) ||
        (data.role === undefined && (missing1 = "role"))
      ) {
        const err7 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing1 },
          message: "must have required property '" + missing1 + "'",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      } else {
        const _errs11 = errors;
        for (const key1 in data) {
          if (!(key1 === "role" || key1 === "team")) {
            const err8 = {
              instancePath,
              schemaPath: "#/oneOf/1/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
            break;
          }
        }
        if (_errs11 === errors) {
          if (data.role !== undefined) {
            let data2 = data.role;
            const _errs12 = errors;
            if (typeof data2 !== "string") {
              const err9 = {
                instancePath: instancePath + "/role",
                schemaPath: "#/$defs/DevelopmentAgent/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
            if (
              !(
                data2 === "RustDev" ||
                data2 === "RustRefactoring" ||
                data2 === "RustVerifier" ||
                data2 === "TypescriptDev" ||
                data2 === "WebDesigner"
              )
            ) {
              const err10 = {
                instancePath: instancePath + "/role",
                schemaPath: "#/$defs/DevelopmentAgent/enum",
                keyword: "enum",
                params: { allowedValues: schema47.enum },
                message: "must be equal to one of the allowed values",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
            var valid3 = _errs12 === errors;
          } else {
            var valid3 = true;
          }
          if (valid3) {
            if (data.team !== undefined) {
              let data3 = data.team;
              const _errs15 = errors;
              if (typeof data3 !== "string") {
                const err11 = {
                  instancePath: instancePath + "/team",
                  schemaPath: "#/oneOf/1/properties/team/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err11];
                } else {
                  vErrors.push(err11);
                }
                errors++;
              }
              if ("Development" !== data3) {
                const err12 = {
                  instancePath: instancePath + "/team",
                  schemaPath: "#/oneOf/1/properties/team/const",
                  keyword: "const",
                  params: { allowedValue: "Development" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err12];
                } else {
                  vErrors.push(err12);
                }
                errors++;
              }
              var valid3 = _errs15 === errors;
            } else {
              var valid3 = true;
            }
          }
        }
      }
    } else {
      const err13 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
  }
  var _valid0 = _errs9 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs17 = errors;
    if (errors === _errs17) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (
          (data.team === undefined && (missing2 = "team")) ||
          (data.role === undefined && (missing2 = "role"))
        ) {
          const err14 = {
            instancePath,
            schemaPath: "#/oneOf/2/required",
            keyword: "required",
            params: { missingProperty: missing2 },
            message: "must have required property '" + missing2 + "'",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        } else {
          const _errs19 = errors;
          for (const key2 in data) {
            if (!(key2 === "role" || key2 === "team")) {
              const err15 = {
                instancePath,
                schemaPath: "#/oneOf/2/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key2 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
              break;
            }
          }
          if (_errs19 === errors) {
            if (data.role !== undefined) {
              let data4 = data.role;
              const _errs20 = errors;
              if (typeof data4 !== "string") {
                const err16 = {
                  instancePath: instancePath + "/role",
                  schemaPath: "#/$defs/AiAgent/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err16];
                } else {
                  vErrors.push(err16);
                }
                errors++;
              }
              if (!(data4 === "TechWriter")) {
                const err17 = {
                  instancePath: instancePath + "/role",
                  schemaPath: "#/$defs/AiAgent/enum",
                  keyword: "enum",
                  params: { allowedValues: schema48.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err17];
                } else {
                  vErrors.push(err17);
                }
                errors++;
              }
              var valid5 = _errs20 === errors;
            } else {
              var valid5 = true;
            }
            if (valid5) {
              if (data.team !== undefined) {
                let data5 = data.team;
                const _errs23 = errors;
                if (typeof data5 !== "string") {
                  const err18 = {
                    instancePath: instancePath + "/team",
                    schemaPath: "#/oneOf/2/properties/team/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err18];
                  } else {
                    vErrors.push(err18);
                  }
                  errors++;
                }
                if ("Ai" !== data5) {
                  const err19 = {
                    instancePath: instancePath + "/team",
                    schemaPath: "#/oneOf/2/properties/team/const",
                    keyword: "const",
                    params: { allowedValue: "Ai" },
                    message: "must be equal to constant",
                  };
                  if (vErrors === null) {
                    vErrors = [err19];
                  } else {
                    vErrors.push(err19);
                  }
                  errors++;
                }
                var valid5 = _errs23 === errors;
              } else {
                var valid5 = true;
              }
            }
          }
        }
      } else {
        const err20 = {
          instancePath,
          schemaPath: "#/oneOf/2/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    var _valid0 = _errs17 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs25 = errors;
      if (errors === _errs25) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing3;
          if (
            (data.team === undefined && (missing3 = "team")) ||
            (data.role === undefined && (missing3 = "role"))
          ) {
            const err21 = {
              instancePath,
              schemaPath: "#/oneOf/3/required",
              keyword: "required",
              params: { missingProperty: missing3 },
              message: "must have required property '" + missing3 + "'",
            };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          } else {
            const _errs27 = errors;
            for (const key3 in data) {
              if (!(key3 === "role" || key3 === "team")) {
                const err22 = {
                  instancePath,
                  schemaPath: "#/oneOf/3/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err22];
                } else {
                  vErrors.push(err22);
                }
                errors++;
                break;
              }
            }
            if (_errs27 === errors) {
              if (data.role !== undefined) {
                let data6 = data.role;
                const _errs28 = errors;
                if (typeof data6 !== "string") {
                  const err23 = {
                    instancePath: instancePath + "/role",
                    schemaPath: "#/$defs/SecurityAgent/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err23];
                  } else {
                    vErrors.push(err23);
                  }
                  errors++;
                }
                if (!(data6 === "SecurityAgent")) {
                  const err24 = {
                    instancePath: instancePath + "/role",
                    schemaPath: "#/$defs/SecurityAgent/enum",
                    keyword: "enum",
                    params: { allowedValues: schema49.enum },
                    message: "must be equal to one of the allowed values",
                  };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors++;
                }
                var valid7 = _errs28 === errors;
              } else {
                var valid7 = true;
              }
              if (valid7) {
                if (data.team !== undefined) {
                  let data7 = data.team;
                  const _errs31 = errors;
                  if (typeof data7 !== "string") {
                    const err25 = {
                      instancePath: instancePath + "/team",
                      schemaPath: "#/oneOf/3/properties/team/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err25];
                    } else {
                      vErrors.push(err25);
                    }
                    errors++;
                  }
                  if ("Security" !== data7) {
                    const err26 = {
                      instancePath: instancePath + "/team",
                      schemaPath: "#/oneOf/3/properties/team/const",
                      keyword: "const",
                      params: { allowedValue: "Security" },
                      message: "must be equal to constant",
                    };
                    if (vErrors === null) {
                      vErrors = [err26];
                    } else {
                      vErrors.push(err26);
                    }
                    errors++;
                  }
                  var valid7 = _errs31 === errors;
                } else {
                  var valid7 = true;
                }
              }
            }
          }
        } else {
          const err27 = {
            instancePath,
            schemaPath: "#/oneOf/3/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      }
      var _valid0 = _errs25 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs33 = errors;
        if (errors === _errs33) {
          if (data && typeof data == "object" && !Array.isArray(data)) {
            let missing4;
            if (
              (data.team === undefined && (missing4 = "team")) ||
              (data.role === undefined && (missing4 = "role"))
            ) {
              const err28 = {
                instancePath,
                schemaPath: "#/oneOf/4/required",
                keyword: "required",
                params: { missingProperty: missing4 },
                message: "must have required property '" + missing4 + "'",
              };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            } else {
              const _errs35 = errors;
              for (const key4 in data) {
                if (!(key4 === "role" || key4 === "team")) {
                  const err29 = {
                    instancePath,
                    schemaPath: "#/oneOf/4/additionalProperties",
                    keyword: "additionalProperties",
                    params: { additionalProperty: key4 },
                    message: "must NOT have additional properties",
                  };
                  if (vErrors === null) {
                    vErrors = [err29];
                  } else {
                    vErrors.push(err29);
                  }
                  errors++;
                  break;
                }
              }
              if (_errs35 === errors) {
                if (data.role !== undefined) {
                  let data8 = data.role;
                  const _errs36 = errors;
                  if (typeof data8 !== "string") {
                    const err30 = {
                      instancePath: instancePath + "/role",
                      schemaPath: "#/$defs/SreAgent/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err30];
                    } else {
                      vErrors.push(err30);
                    }
                    errors++;
                  }
                  if (
                    !(
                      data8 === "CicdAgent" ||
                      data8 === "DockerSpecialist" ||
                      data8 === "KubernetesSpecialist"
                    )
                  ) {
                    const err31 = {
                      instancePath: instancePath + "/role",
                      schemaPath: "#/$defs/SreAgent/enum",
                      keyword: "enum",
                      params: { allowedValues: schema50.enum },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err31];
                    } else {
                      vErrors.push(err31);
                    }
                    errors++;
                  }
                  var valid9 = _errs36 === errors;
                } else {
                  var valid9 = true;
                }
                if (valid9) {
                  if (data.team !== undefined) {
                    let data9 = data.team;
                    const _errs39 = errors;
                    if (typeof data9 !== "string") {
                      const err32 = {
                        instancePath: instancePath + "/team",
                        schemaPath: "#/oneOf/4/properties/team/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      };
                      if (vErrors === null) {
                        vErrors = [err32];
                      } else {
                        vErrors.push(err32);
                      }
                      errors++;
                    }
                    if ("Sre" !== data9) {
                      const err33 = {
                        instancePath: instancePath + "/team",
                        schemaPath: "#/oneOf/4/properties/team/const",
                        keyword: "const",
                        params: { allowedValue: "Sre" },
                        message: "must be equal to constant",
                      };
                      if (vErrors === null) {
                        vErrors = [err33];
                      } else {
                        vErrors.push(err33);
                      }
                      errors++;
                    }
                    var valid9 = _errs39 === errors;
                  } else {
                    var valid9 = true;
                  }
                }
              }
            }
          } else {
            const err34 = {
              instancePath,
              schemaPath: "#/oneOf/4/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
        }
        var _valid0 = _errs33 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs41 = errors;
          if (errors === _errs41) {
            if (data && typeof data == "object" && !Array.isArray(data)) {
              let missing5;
              if (
                (data.team === undefined && (missing5 = "team")) ||
                (data.role === undefined && (missing5 = "role"))
              ) {
                const err35 = {
                  instancePath,
                  schemaPath: "#/oneOf/5/required",
                  keyword: "required",
                  params: { missingProperty: missing5 },
                  message: "must have required property '" + missing5 + "'",
                };
                if (vErrors === null) {
                  vErrors = [err35];
                } else {
                  vErrors.push(err35);
                }
                errors++;
              } else {
                const _errs43 = errors;
                for (const key5 in data) {
                  if (!(key5 === "role" || key5 === "team")) {
                    const err36 = {
                      instancePath,
                      schemaPath: "#/oneOf/5/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key5 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err36];
                    } else {
                      vErrors.push(err36);
                    }
                    errors++;
                    break;
                  }
                }
                if (_errs43 === errors) {
                  if (data.role !== undefined) {
                    let data10 = data.role;
                    const _errs44 = errors;
                    if (typeof data10 !== "string") {
                      const err37 = {
                        instancePath: instancePath + "/role",
                        schemaPath: "#/$defs/DeliveryAgent/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      };
                      if (vErrors === null) {
                        vErrors = [err37];
                      } else {
                        vErrors.push(err37);
                      }
                      errors++;
                    }
                    if (
                      !(data10 === "IntegrationAgent" || data10 === "PrAgent")
                    ) {
                      const err38 = {
                        instancePath: instancePath + "/role",
                        schemaPath: "#/$defs/DeliveryAgent/enum",
                        keyword: "enum",
                        params: { allowedValues: schema51.enum },
                        message: "must be equal to one of the allowed values",
                      };
                      if (vErrors === null) {
                        vErrors = [err38];
                      } else {
                        vErrors.push(err38);
                      }
                      errors++;
                    }
                    var valid11 = _errs44 === errors;
                  } else {
                    var valid11 = true;
                  }
                  if (valid11) {
                    if (data.team !== undefined) {
                      let data11 = data.team;
                      const _errs47 = errors;
                      if (typeof data11 !== "string") {
                        const err39 = {
                          instancePath: instancePath + "/team",
                          schemaPath: "#/oneOf/5/properties/team/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        };
                        if (vErrors === null) {
                          vErrors = [err39];
                        } else {
                          vErrors.push(err39);
                        }
                        errors++;
                      }
                      if ("Delivery" !== data11) {
                        const err40 = {
                          instancePath: instancePath + "/team",
                          schemaPath: "#/oneOf/5/properties/team/const",
                          keyword: "const",
                          params: { allowedValue: "Delivery" },
                          message: "must be equal to constant",
                        };
                        if (vErrors === null) {
                          vErrors = [err40];
                        } else {
                          vErrors.push(err40);
                        }
                        errors++;
                      }
                      var valid11 = _errs47 === errors;
                    } else {
                      var valid11 = true;
                    }
                  }
                }
              }
            } else {
              const err41 = {
                instancePath,
                schemaPath: "#/oneOf/5/type",
                keyword: "type",
                params: { type: "object" },
                message: "must be object",
              };
              if (vErrors === null) {
                vErrors = [err41];
              } else {
                vErrors.push(err41);
              }
              errors++;
            }
          }
          var _valid0 = _errs41 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err42 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err42];
    } else {
      vErrors.push(err42);
    }
    errors++;
    validate34.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate34.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate34.evaluated = { dynamicProps: true, dynamicItems: false };
function validate33(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.commit === undefined && (missing0 = "commit")) ||
        (data.actor === undefined && (missing0 = "actor")) ||
        (data.at === undefined && (missing0 = "at")) ||
        (data.revision === undefined && (missing0 = "revision"))
      ) {
        validate33.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.actor !== undefined) {
          const _errs1 = errors;
          if (
            !validate34(data.actor, {
              instancePath: instancePath + "/actor",
              parentData: data,
              parentDataProperty: "actor",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate34.errors
                : vErrors.concat(validate34.errors);
            errors = vErrors.length;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.at !== undefined) {
            let data1 = data.at;
            const _errs2 = errors;
            if (!(typeof data1 == "number" && !(data1 % 1) && !isNaN(data1))) {
              validate33.errors = [
                {
                  instancePath: instancePath + "/at",
                  schemaPath: "#/properties/at/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commit !== undefined) {
              const _errs4 = errors;
              if (typeof data.commit !== "string") {
                validate33.errors = [
                  {
                    instancePath: instancePath + "/commit",
                    schemaPath: "#/properties/commit/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.revision !== undefined) {
                let data3 = data.revision;
                const _errs6 = errors;
                if (
                  !(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))
                ) {
                  validate33.errors = [
                    {
                      instancePath: instancePath + "/revision",
                      schemaPath: "#/properties/revision/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate33.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors === 0;
}
validate33.evaluated = {
  props: { actor: true, at: true, commit: true, revision: true },
  dynamicProps: false,
  dynamicItems: false,
};
const schema52 = {
  oneOf: [
    {
      properties: { kind: { const: "unrecorded", type: "string" } },
      required: ["kind"],
      type: "object",
    },
    {
      properties: {
        agent: { $ref: "#/$defs/AgentId" },
        kind: { const: "recorded", type: "string" },
      },
      required: ["kind", "agent"],
      type: "object",
    },
  ],
};
function validate37(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate37.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.kind === undefined && (missing0 = "kind")) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        if (data.kind !== undefined) {
          let data0 = data.kind;
          if (typeof data0 !== "string") {
            const err1 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/0/properties/kind/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
          if ("unrecorded" !== data0) {
            const err2 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/0/properties/kind/const",
              keyword: "const",
              params: { allowedValue: "unrecorded" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
      }
    } else {
      const err3 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = {};
    props0.kind = true;
  }
  const _errs5 = errors;
  if (errors === _errs5) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (
        (data.kind === undefined && (missing1 = "kind")) ||
        (data.agent === undefined && (missing1 = "agent"))
      ) {
        const err4 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing1 },
          message: "must have required property '" + missing1 + "'",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      } else {
        if (data.agent !== undefined) {
          const _errs7 = errors;
          if (
            !validate34(data.agent, {
              instancePath: instancePath + "/agent",
              parentData: data,
              parentDataProperty: "agent",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate34.errors
                : vErrors.concat(validate34.errors);
            errors = vErrors.length;
          }
          var valid2 = _errs7 === errors;
        } else {
          var valid2 = true;
        }
        if (valid2) {
          if (data.kind !== undefined) {
            let data2 = data.kind;
            const _errs8 = errors;
            if (typeof data2 !== "string") {
              const err5 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/1/properties/kind/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors++;
            }
            if ("recorded" !== data2) {
              const err6 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/1/properties/kind/const",
                keyword: "const",
                params: { allowedValue: "recorded" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err6];
              } else {
                vErrors.push(err6);
              }
              errors++;
            }
            var valid2 = _errs8 === errors;
          } else {
            var valid2 = true;
          }
        }
      }
    } else {
      const err7 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
  }
  var _valid0 = _errs5 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = props0 || {};
        props0.agent = true;
        props0.kind = true;
      }
    }
  }
  if (!valid0) {
    const err8 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
    validate37.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate37.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate37.evaluated = { dynamicProps: true, dynamicItems: false };
const schema54 = {
  properties: {
    actor: { $ref: "#/$defs/AgentId" },
    at: { format: "int64", type: "integer" },
    attempt: { format: "int64", type: "integer" },
    kind: { $ref: "#/$defs/EventKind" },
    note: { $ref: "#/$defs/Note" },
    revision: { format: "int64", type: "integer" },
  },
  required: ["kind", "actor", "at", "revision", "attempt", "note"],
  type: "object",
};
const schema55 = {
  enum: [
    "created",
    "claimed",
    "heartbeat",
    "progress",
    "checkpoint",
    "ready",
    "integrated",
    "requeued",
    "cancelled",
  ],
  type: "string",
};
function validate41(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate41.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.actor === undefined && (missing0 = "actor")) ||
        (data.at === undefined && (missing0 = "at")) ||
        (data.revision === undefined && (missing0 = "revision")) ||
        (data.attempt === undefined && (missing0 = "attempt")) ||
        (data.note === undefined && (missing0 = "note"))
      ) {
        validate41.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.actor !== undefined) {
          const _errs1 = errors;
          if (
            !validate34(data.actor, {
              instancePath: instancePath + "/actor",
              parentData: data,
              parentDataProperty: "actor",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate34.errors
                : vErrors.concat(validate34.errors);
            errors = vErrors.length;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.at !== undefined) {
            let data1 = data.at;
            const _errs2 = errors;
            if (!(typeof data1 == "number" && !(data1 % 1) && !isNaN(data1))) {
              validate41.errors = [
                {
                  instancePath: instancePath + "/at",
                  schemaPath: "#/properties/at/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attempt !== undefined) {
              let data2 = data.attempt;
              const _errs4 = errors;
              if (
                !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
              ) {
                validate41.errors = [
                  {
                    instancePath: instancePath + "/attempt",
                    schemaPath: "#/properties/attempt/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.kind !== undefined) {
                let data3 = data.kind;
                const _errs6 = errors;
                if (typeof data3 !== "string") {
                  validate41.errors = [
                    {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/$defs/EventKind/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                if (
                  !(
                    data3 === "created" ||
                    data3 === "claimed" ||
                    data3 === "heartbeat" ||
                    data3 === "progress" ||
                    data3 === "checkpoint" ||
                    data3 === "ready" ||
                    data3 === "integrated" ||
                    data3 === "requeued" ||
                    data3 === "cancelled"
                  )
                ) {
                  validate41.errors = [
                    {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/$defs/EventKind/enum",
                      keyword: "enum",
                      params: { allowedValues: schema55.enum },
                      message: "must be equal to one of the allowed values",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.note !== undefined) {
                  const _errs9 = errors;
                  if (typeof data.note !== "string") {
                    validate41.errors = [
                      {
                        instancePath: instancePath + "/note",
                        schemaPath: "#/$defs/Note/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.revision !== undefined) {
                    let data5 = data.revision;
                    const _errs12 = errors;
                    if (
                      !(
                        typeof data5 == "number" &&
                        !(data5 % 1) &&
                        !isNaN(data5)
                      )
                    ) {
                      validate41.errors = [
                        {
                          instancePath: instancePath + "/revision",
                          schemaPath: "#/properties/revision/type",
                          keyword: "type",
                          params: { type: "integer" },
                          message: "must be integer",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs12 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate41.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate41.errors = vErrors;
  return errors === 0;
}
validate41.evaluated = {
  props: {
    actor: true,
    at: true,
    attempt: true,
    kind: true,
    note: true,
    revision: true,
  },
  dynamicProps: false,
  dynamicItems: false,
};
const schema57 = {
  additionalProperties: false,
  properties: {
    acceptance: { items: { $ref: "#/$defs/Note" }, type: "array" },
    attempt: { format: "int64", type: "integer" },
    checkpoint: { $ref: "#/$defs/Checkpoint" },
    created_at: { format: "int64", type: "integer" },
    dependencies: { items: { type: "string" }, type: "array" },
    feature: { type: "string" },
    id: { type: "string" },
    last_progress: { format: "int64", type: "integer" },
    last_update: { format: "int64", type: "integer" },
    objective: { $ref: "#/$defs/Note" },
    progress: { $ref: "#/$defs/Progress" },
    revision: { format: "int64", type: "integer" },
    state: { $ref: "#/$defs/TaskState" },
    version: { format: "int64", type: "integer" },
    workspace: { $ref: "#/$defs/Workspace" },
  },
  required: [
    "version",
    "id",
    "feature",
    "objective",
    "acceptance",
    "dependencies",
    "workspace",
    "revision",
    "attempt",
    "state",
    "created_at",
    "last_update",
    "last_progress",
    "checkpoint",
    "progress",
  ],
  type: "object",
};
const schema59 = {
  oneOf: [
    {
      additionalProperties: false,
      properties: { kind: { const: "unrecorded", type: "string" } },
      required: ["kind"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        commit: { type: "string" },
        kind: { const: "git", type: "string" },
      },
      required: ["kind", "commit"],
      type: "object",
    },
  ],
};
const schema74 = {
  oneOf: [
    {
      additionalProperties: false,
      properties: { kind: { const: "read_only", type: "string" } },
      required: ["kind"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        branch: { type: "string" },
        kind: { const: "git", type: "string" },
        path: { type: "string" },
      },
      required: ["kind", "branch", "path"],
      type: "object",
    },
  ],
};
const func1 = Object.prototype.hasOwnProperty;
const schema61 = {
  additionalProperties: false,
  properties: {
    checks: { items: { $ref: "#/$defs/Check" }, type: "array" },
    extensions: {
      additionalProperties: true,
      default: {},
      description:
        "Task-specific data only. Coordination never interprets these keys.",
      type: "object",
    },
    findings: { items: { $ref: "#/$defs/Note" }, type: "array" },
    next_steps: { items: { $ref: "#/$defs/Note" }, type: "array" },
    summary: { $ref: "#/$defs/Note" },
  },
  required: ["summary", "findings", "next_steps", "checks"],
  type: "object",
};
const schema62 = {
  additionalProperties: false,
  properties: {
    command: { $ref: "#/$defs/Note" },
    evidence: { $ref: "#/$defs/Note" },
    outcome: { $ref: "#/$defs/CheckOutcome" },
  },
  required: ["command", "outcome", "evidence"],
  type: "object",
};
const schema65 = { enum: ["passed", "failed", "not_run"], type: "string" };
function validate46(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate46.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.command === undefined && (missing0 = "command")) ||
        (data.outcome === undefined && (missing0 = "outcome")) ||
        (data.evidence === undefined && (missing0 = "evidence"))
      ) {
        validate46.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(key0 === "command" || key0 === "evidence" || key0 === "outcome")
          ) {
            validate46.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.command !== undefined) {
            const _errs2 = errors;
            if (typeof data.command !== "string") {
              validate46.errors = [
                {
                  instancePath: instancePath + "/command",
                  schemaPath: "#/$defs/Note/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.evidence !== undefined) {
              const _errs5 = errors;
              if (typeof data.evidence !== "string") {
                validate46.errors = [
                  {
                    instancePath: instancePath + "/evidence",
                    schemaPath: "#/$defs/Note/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.outcome !== undefined) {
                let data2 = data.outcome;
                const _errs8 = errors;
                if (typeof data2 !== "string") {
                  validate46.errors = [
                    {
                      instancePath: instancePath + "/outcome",
                      schemaPath: "#/$defs/CheckOutcome/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                if (
                  !(
                    data2 === "passed" ||
                    data2 === "failed" ||
                    data2 === "not_run"
                  )
                ) {
                  validate46.errors = [
                    {
                      instancePath: instancePath + "/outcome",
                      schemaPath: "#/$defs/CheckOutcome/enum",
                      keyword: "enum",
                      params: { allowedValues: schema65.enum },
                      message: "must be equal to one of the allowed values",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs8 === errors;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate46.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate46.errors = vErrors;
  return errors === 0;
}
validate46.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate45(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate45.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.summary === undefined && (missing0 = "summary")) ||
        (data.findings === undefined && (missing0 = "findings")) ||
        (data.next_steps === undefined && (missing0 = "next_steps")) ||
        (data.checks === undefined && (missing0 = "checks"))
      ) {
        validate45.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "checks" ||
              key0 === "extensions" ||
              key0 === "findings" ||
              key0 === "next_steps" ||
              key0 === "summary"
            )
          ) {
            validate45.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.checks !== undefined) {
            let data0 = data.checks;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (
                    !validate46(data0[i0], {
                      instancePath: instancePath + "/checks/" + i0,
                      parentData: data0,
                      parentDataProperty: i0,
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate46.errors
                        : vErrors.concat(validate46.errors);
                    errors = vErrors.length;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate45.errors = [
                  {
                    instancePath: instancePath + "/checks",
                    schemaPath: "#/properties/checks/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.extensions !== undefined) {
              let data2 = data.extensions;
              const _errs5 = errors;
              if (errors === _errs5) {
                if (
                  data2 &&
                  typeof data2 == "object" &&
                  !Array.isArray(data2)
                ) {
                } else {
                  validate45.errors = [
                    {
                      instancePath: instancePath + "/extensions",
                      schemaPath: "#/properties/extensions/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.findings !== undefined) {
                let data3 = data.findings;
                const _errs8 = errors;
                if (errors === _errs8) {
                  if (Array.isArray(data3)) {
                    var valid2 = true;
                    const len1 = data3.length;
                    for (let i1 = 0; i1 < len1; i1++) {
                      const _errs10 = errors;
                      if (typeof data3[i1] !== "string") {
                        validate45.errors = [
                          {
                            instancePath: instancePath + "/findings/" + i1,
                            schemaPath: "#/$defs/Note/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      var valid2 = _errs10 === errors;
                      if (!valid2) {
                        break;
                      }
                    }
                  } else {
                    validate45.errors = [
                      {
                        instancePath: instancePath + "/findings",
                        schemaPath: "#/properties/findings/type",
                        keyword: "type",
                        params: { type: "array" },
                        message: "must be array",
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs8 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.next_steps !== undefined) {
                  let data5 = data.next_steps;
                  const _errs13 = errors;
                  if (errors === _errs13) {
                    if (Array.isArray(data5)) {
                      var valid4 = true;
                      const len2 = data5.length;
                      for (let i2 = 0; i2 < len2; i2++) {
                        const _errs15 = errors;
                        if (typeof data5[i2] !== "string") {
                          validate45.errors = [
                            {
                              instancePath: instancePath + "/next_steps/" + i2,
                              schemaPath: "#/$defs/Note/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        var valid4 = _errs15 === errors;
                        if (!valid4) {
                          break;
                        }
                      }
                    } else {
                      validate45.errors = [
                        {
                          instancePath: instancePath + "/next_steps",
                          schemaPath: "#/properties/next_steps/type",
                          keyword: "type",
                          params: { type: "array" },
                          message: "must be array",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs13 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.summary !== undefined) {
                    const _errs18 = errors;
                    if (typeof data.summary !== "string") {
                      validate45.errors = [
                        {
                          instancePath: instancePath + "/summary",
                          schemaPath: "#/$defs/Note/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs18 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate45.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate45.errors = vErrors;
  return errors === 0;
}
validate45.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const schema69 = {
  oneOf: [
    {
      additionalProperties: false,
      properties: { kind: { const: "queued", type: "string" } },
      required: ["kind"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        assignment: { $ref: "#/$defs/Assignment" },
        kind: { const: "active", type: "string" },
      },
      required: ["kind", "assignment"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        agent: { $ref: "#/$defs/AgentId" },
        attempt: { format: "int64", type: "integer" },
        kind: { const: "ready", type: "string" },
      },
      required: ["kind", "agent", "attempt"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        commit: { type: "string" },
        kind: { const: "integrated", type: "string" },
      },
      required: ["kind", "commit"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        kind: { const: "cancelled", type: "string" },
        reason: { $ref: "#/$defs/Note" },
      },
      required: ["kind", "reason"],
      type: "object",
    },
  ],
};
const schema70 = {
  additionalProperties: false,
  properties: {
    agent: { $ref: "#/$defs/AgentId" },
    attempt: { format: "int64", type: "integer" },
    expires_at: { format: "int64", type: "integer" },
    phase: { $ref: "#/$defs/Phase" },
  },
  required: ["agent", "attempt", "expires_at", "phase"],
  type: "object",
};
const schema71 = {
  oneOf: [
    {
      additionalProperties: false,
      properties: { kind: { const: "working", type: "string" } },
      required: ["kind"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        kind: { const: "blocked", type: "string" },
        reason: { $ref: "#/$defs/Note" },
      },
      required: ["kind", "reason"],
      type: "object",
    },
  ],
};
function validate52(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate52.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.kind === undefined && (missing0 = "kind")) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        const _errs3 = errors;
        for (const key0 in data) {
          if (!(key0 === "kind")) {
            const err1 = {
              instancePath,
              schemaPath: "#/oneOf/0/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
            break;
          }
        }
        if (_errs3 === errors) {
          if (data.kind !== undefined) {
            let data0 = data.kind;
            if (typeof data0 !== "string") {
              const err2 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/0/properties/kind/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
            if ("working" !== data0) {
              const err3 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/0/properties/kind/const",
                keyword: "const",
                params: { allowedValue: "working" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
          }
        }
      }
    } else {
      const err4 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs6 = errors;
  if (errors === _errs6) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (
        (data.kind === undefined && (missing1 = "kind")) ||
        (data.reason === undefined && (missing1 = "reason"))
      ) {
        const err5 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing1 },
          message: "must have required property '" + missing1 + "'",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      } else {
        const _errs8 = errors;
        for (const key1 in data) {
          if (!(key1 === "kind" || key1 === "reason")) {
            const err6 = {
              instancePath,
              schemaPath: "#/oneOf/1/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
            break;
          }
        }
        if (_errs8 === errors) {
          if (data.kind !== undefined) {
            let data1 = data.kind;
            const _errs9 = errors;
            if (typeof data1 !== "string") {
              const err7 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/1/properties/kind/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err7];
              } else {
                vErrors.push(err7);
              }
              errors++;
            }
            if ("blocked" !== data1) {
              const err8 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/1/properties/kind/const",
                keyword: "const",
                params: { allowedValue: "blocked" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
            var valid2 = _errs9 === errors;
          } else {
            var valid2 = true;
          }
          if (valid2) {
            if (data.reason !== undefined) {
              const _errs11 = errors;
              if (typeof data.reason !== "string") {
                const err9 = {
                  instancePath: instancePath + "/reason",
                  schemaPath: "#/$defs/Note/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err9];
                } else {
                  vErrors.push(err9);
                }
                errors++;
              }
              var valid2 = _errs11 === errors;
            } else {
              var valid2 = true;
            }
          }
        }
      }
    } else {
      const err10 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
  }
  if (!valid0) {
    const err11 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
    validate52.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate52.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate52.evaluated = { dynamicProps: true, dynamicItems: false };
function validate50(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate50.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.agent === undefined && (missing0 = "agent")) ||
        (data.attempt === undefined && (missing0 = "attempt")) ||
        (data.expires_at === undefined && (missing0 = "expires_at")) ||
        (data.phase === undefined && (missing0 = "phase"))
      ) {
        validate50.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "agent" ||
              key0 === "attempt" ||
              key0 === "expires_at" ||
              key0 === "phase"
            )
          ) {
            validate50.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.agent !== undefined) {
            const _errs2 = errors;
            if (
              !validate34(data.agent, {
                instancePath: instancePath + "/agent",
                parentData: data,
                parentDataProperty: "agent",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate34.errors
                  : vErrors.concat(validate34.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attempt !== undefined) {
              let data1 = data.attempt;
              const _errs3 = errors;
              if (
                !(typeof data1 == "number" && !(data1 % 1) && !isNaN(data1))
              ) {
                validate50.errors = [
                  {
                    instancePath: instancePath + "/attempt",
                    schemaPath: "#/properties/attempt/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  },
                ];
                return false;
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.expires_at !== undefined) {
                let data2 = data.expires_at;
                const _errs5 = errors;
                if (
                  !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
                ) {
                  validate50.errors = [
                    {
                      instancePath: instancePath + "/expires_at",
                      schemaPath: "#/properties/expires_at/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs5 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.phase !== undefined) {
                  const _errs7 = errors;
                  if (
                    !validate52(data.phase, {
                      instancePath: instancePath + "/phase",
                      parentData: data,
                      parentDataProperty: "phase",
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate52.errors
                        : vErrors.concat(validate52.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs7 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate50.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate50.errors = vErrors;
  return errors === 0;
}
validate50.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate49(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate49.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.kind === undefined && (missing0 = "kind")) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        const _errs3 = errors;
        for (const key0 in data) {
          if (!(key0 === "kind")) {
            const err1 = {
              instancePath,
              schemaPath: "#/oneOf/0/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
            break;
          }
        }
        if (_errs3 === errors) {
          if (data.kind !== undefined) {
            let data0 = data.kind;
            if (typeof data0 !== "string") {
              const err2 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/0/properties/kind/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
            if ("queued" !== data0) {
              const err3 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/0/properties/kind/const",
                keyword: "const",
                params: { allowedValue: "queued" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
          }
        }
      }
    } else {
      const err4 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs6 = errors;
  if (errors === _errs6) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (
        (data.kind === undefined && (missing1 = "kind")) ||
        (data.assignment === undefined && (missing1 = "assignment"))
      ) {
        const err5 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing1 },
          message: "must have required property '" + missing1 + "'",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      } else {
        const _errs8 = errors;
        for (const key1 in data) {
          if (!(key1 === "assignment" || key1 === "kind")) {
            const err6 = {
              instancePath,
              schemaPath: "#/oneOf/1/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
            break;
          }
        }
        if (_errs8 === errors) {
          if (data.assignment !== undefined) {
            const _errs9 = errors;
            if (
              !validate50(data.assignment, {
                instancePath: instancePath + "/assignment",
                parentData: data,
                parentDataProperty: "assignment",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate50.errors
                  : vErrors.concat(validate50.errors);
              errors = vErrors.length;
            }
            var valid2 = _errs9 === errors;
          } else {
            var valid2 = true;
          }
          if (valid2) {
            if (data.kind !== undefined) {
              let data2 = data.kind;
              const _errs10 = errors;
              if (typeof data2 !== "string") {
                const err7 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/1/properties/kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err7];
                } else {
                  vErrors.push(err7);
                }
                errors++;
              }
              if ("active" !== data2) {
                const err8 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/1/properties/kind/const",
                  keyword: "const",
                  params: { allowedValue: "active" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err8];
                } else {
                  vErrors.push(err8);
                }
                errors++;
              }
              var valid2 = _errs10 === errors;
            } else {
              var valid2 = true;
            }
          }
        }
      }
    } else {
      const err9 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs12 = errors;
    if (errors === _errs12) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (
          (data.kind === undefined && (missing2 = "kind")) ||
          (data.agent === undefined && (missing2 = "agent")) ||
          (data.attempt === undefined && (missing2 = "attempt"))
        ) {
          const err10 = {
            instancePath,
            schemaPath: "#/oneOf/2/required",
            keyword: "required",
            params: { missingProperty: missing2 },
            message: "must have required property '" + missing2 + "'",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        } else {
          const _errs14 = errors;
          for (const key2 in data) {
            if (!(key2 === "agent" || key2 === "attempt" || key2 === "kind")) {
              const err11 = {
                instancePath,
                schemaPath: "#/oneOf/2/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key2 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
              break;
            }
          }
          if (_errs14 === errors) {
            if (data.agent !== undefined) {
              const _errs15 = errors;
              if (
                !validate34(data.agent, {
                  instancePath: instancePath + "/agent",
                  parentData: data,
                  parentDataProperty: "agent",
                  rootData,
                  dynamicAnchors,
                })
              ) {
                vErrors =
                  vErrors === null
                    ? validate34.errors
                    : vErrors.concat(validate34.errors);
                errors = vErrors.length;
              }
              var valid3 = _errs15 === errors;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.attempt !== undefined) {
                let data4 = data.attempt;
                const _errs16 = errors;
                if (
                  !(typeof data4 == "number" && !(data4 % 1) && !isNaN(data4))
                ) {
                  const err12 = {
                    instancePath: instancePath + "/attempt",
                    schemaPath: "#/oneOf/2/properties/attempt/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  };
                  if (vErrors === null) {
                    vErrors = [err12];
                  } else {
                    vErrors.push(err12);
                  }
                  errors++;
                }
                var valid3 = _errs16 === errors;
              } else {
                var valid3 = true;
              }
              if (valid3) {
                if (data.kind !== undefined) {
                  let data5 = data.kind;
                  const _errs18 = errors;
                  if (typeof data5 !== "string") {
                    const err13 = {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/oneOf/2/properties/kind/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err13];
                    } else {
                      vErrors.push(err13);
                    }
                    errors++;
                  }
                  if ("ready" !== data5) {
                    const err14 = {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/oneOf/2/properties/kind/const",
                      keyword: "const",
                      params: { allowedValue: "ready" },
                      message: "must be equal to constant",
                    };
                    if (vErrors === null) {
                      vErrors = [err14];
                    } else {
                      vErrors.push(err14);
                    }
                    errors++;
                  }
                  var valid3 = _errs18 === errors;
                } else {
                  var valid3 = true;
                }
              }
            }
          }
        }
      } else {
        const err15 = {
          instancePath,
          schemaPath: "#/oneOf/2/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    var _valid0 = _errs12 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs20 = errors;
      if (errors === _errs20) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing3;
          if (
            (data.kind === undefined && (missing3 = "kind")) ||
            (data.commit === undefined && (missing3 = "commit"))
          ) {
            const err16 = {
              instancePath,
              schemaPath: "#/oneOf/3/required",
              keyword: "required",
              params: { missingProperty: missing3 },
              message: "must have required property '" + missing3 + "'",
            };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          } else {
            const _errs22 = errors;
            for (const key3 in data) {
              if (!(key3 === "commit" || key3 === "kind")) {
                const err17 = {
                  instancePath,
                  schemaPath: "#/oneOf/3/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err17];
                } else {
                  vErrors.push(err17);
                }
                errors++;
                break;
              }
            }
            if (_errs22 === errors) {
              if (data.commit !== undefined) {
                const _errs23 = errors;
                if (typeof data.commit !== "string") {
                  const err18 = {
                    instancePath: instancePath + "/commit",
                    schemaPath: "#/oneOf/3/properties/commit/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err18];
                  } else {
                    vErrors.push(err18);
                  }
                  errors++;
                }
                var valid4 = _errs23 === errors;
              } else {
                var valid4 = true;
              }
              if (valid4) {
                if (data.kind !== undefined) {
                  let data7 = data.kind;
                  const _errs25 = errors;
                  if (typeof data7 !== "string") {
                    const err19 = {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/oneOf/3/properties/kind/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err19];
                    } else {
                      vErrors.push(err19);
                    }
                    errors++;
                  }
                  if ("integrated" !== data7) {
                    const err20 = {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/oneOf/3/properties/kind/const",
                      keyword: "const",
                      params: { allowedValue: "integrated" },
                      message: "must be equal to constant",
                    };
                    if (vErrors === null) {
                      vErrors = [err20];
                    } else {
                      vErrors.push(err20);
                    }
                    errors++;
                  }
                  var valid4 = _errs25 === errors;
                } else {
                  var valid4 = true;
                }
              }
            }
          }
        } else {
          const err21 = {
            instancePath,
            schemaPath: "#/oneOf/3/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      }
      var _valid0 = _errs20 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs27 = errors;
        if (errors === _errs27) {
          if (data && typeof data == "object" && !Array.isArray(data)) {
            let missing4;
            if (
              (data.kind === undefined && (missing4 = "kind")) ||
              (data.reason === undefined && (missing4 = "reason"))
            ) {
              const err22 = {
                instancePath,
                schemaPath: "#/oneOf/4/required",
                keyword: "required",
                params: { missingProperty: missing4 },
                message: "must have required property '" + missing4 + "'",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            } else {
              const _errs29 = errors;
              for (const key4 in data) {
                if (!(key4 === "kind" || key4 === "reason")) {
                  const err23 = {
                    instancePath,
                    schemaPath: "#/oneOf/4/additionalProperties",
                    keyword: "additionalProperties",
                    params: { additionalProperty: key4 },
                    message: "must NOT have additional properties",
                  };
                  if (vErrors === null) {
                    vErrors = [err23];
                  } else {
                    vErrors.push(err23);
                  }
                  errors++;
                  break;
                }
              }
              if (_errs29 === errors) {
                if (data.kind !== undefined) {
                  let data8 = data.kind;
                  const _errs30 = errors;
                  if (typeof data8 !== "string") {
                    const err24 = {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/oneOf/4/properties/kind/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err24];
                    } else {
                      vErrors.push(err24);
                    }
                    errors++;
                  }
                  if ("cancelled" !== data8) {
                    const err25 = {
                      instancePath: instancePath + "/kind",
                      schemaPath: "#/oneOf/4/properties/kind/const",
                      keyword: "const",
                      params: { allowedValue: "cancelled" },
                      message: "must be equal to constant",
                    };
                    if (vErrors === null) {
                      vErrors = [err25];
                    } else {
                      vErrors.push(err25);
                    }
                    errors++;
                  }
                  var valid5 = _errs30 === errors;
                } else {
                  var valid5 = true;
                }
                if (valid5) {
                  if (data.reason !== undefined) {
                    const _errs32 = errors;
                    if (typeof data.reason !== "string") {
                      const err26 = {
                        instancePath: instancePath + "/reason",
                        schemaPath: "#/$defs/Note/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      };
                      if (vErrors === null) {
                        vErrors = [err26];
                      } else {
                        vErrors.push(err26);
                      }
                      errors++;
                    }
                    var valid5 = _errs32 === errors;
                  } else {
                    var valid5 = true;
                  }
                }
              }
            }
          } else {
            const err27 = {
              instancePath,
              schemaPath: "#/oneOf/4/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
        }
        var _valid0 = _errs27 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err28 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err28];
    } else {
      vErrors.push(err28);
    }
    errors++;
    validate49.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate49.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate49.evaluated = { dynamicProps: true, dynamicItems: false };
function validate44(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate44.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.version === undefined && (missing0 = "version")) ||
        (data.id === undefined && (missing0 = "id")) ||
        (data.feature === undefined && (missing0 = "feature")) ||
        (data.objective === undefined && (missing0 = "objective")) ||
        (data.acceptance === undefined && (missing0 = "acceptance")) ||
        (data.dependencies === undefined && (missing0 = "dependencies")) ||
        (data.workspace === undefined && (missing0 = "workspace")) ||
        (data.revision === undefined && (missing0 = "revision")) ||
        (data.attempt === undefined && (missing0 = "attempt")) ||
        (data.state === undefined && (missing0 = "state")) ||
        (data.created_at === undefined && (missing0 = "created_at")) ||
        (data.last_update === undefined && (missing0 = "last_update")) ||
        (data.last_progress === undefined && (missing0 = "last_progress")) ||
        (data.checkpoint === undefined && (missing0 = "checkpoint")) ||
        (data.progress === undefined && (missing0 = "progress"))
      ) {
        validate44.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema57.properties, key0)) {
            validate44.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.acceptance !== undefined) {
            let data0 = data.acceptance;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (typeof data0[i0] !== "string") {
                    validate44.errors = [
                      {
                        instancePath: instancePath + "/acceptance/" + i0,
                        schemaPath: "#/$defs/Note/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate44.errors = [
                  {
                    instancePath: instancePath + "/acceptance",
                    schemaPath: "#/properties/acceptance/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attempt !== undefined) {
              let data2 = data.attempt;
              const _errs7 = errors;
              if (
                !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
              ) {
                validate44.errors = [
                  {
                    instancePath: instancePath + "/attempt",
                    schemaPath: "#/properties/attempt/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  },
                ];
                return false;
              }
              var valid0 = _errs7 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.checkpoint !== undefined) {
                let data3 = data.checkpoint;
                const _errs9 = errors;
                const _errs11 = errors;
                let valid4 = false;
                let passing0 = null;
                const _errs12 = errors;
                if (errors === _errs12) {
                  if (
                    data3 &&
                    typeof data3 == "object" &&
                    !Array.isArray(data3)
                  ) {
                    let missing1;
                    if (data3.kind === undefined && (missing1 = "kind")) {
                      const err0 = {
                        instancePath: instancePath + "/checkpoint",
                        schemaPath: "#/$defs/Checkpoint/oneOf/0/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors++;
                    } else {
                      const _errs14 = errors;
                      for (const key1 in data3) {
                        if (!(key1 === "kind")) {
                          const err1 = {
                            instancePath: instancePath + "/checkpoint",
                            schemaPath:
                              "#/$defs/Checkpoint/oneOf/0/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors++;
                          break;
                        }
                      }
                      if (_errs14 === errors) {
                        if (data3.kind !== undefined) {
                          let data4 = data3.kind;
                          if (typeof data4 !== "string") {
                            const err2 = {
                              instancePath: instancePath + "/checkpoint/kind",
                              schemaPath:
                                "#/$defs/Checkpoint/oneOf/0/properties/kind/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            };
                            if (vErrors === null) {
                              vErrors = [err2];
                            } else {
                              vErrors.push(err2);
                            }
                            errors++;
                          }
                          if ("unrecorded" !== data4) {
                            const err3 = {
                              instancePath: instancePath + "/checkpoint/kind",
                              schemaPath:
                                "#/$defs/Checkpoint/oneOf/0/properties/kind/const",
                              keyword: "const",
                              params: { allowedValue: "unrecorded" },
                              message: "must be equal to constant",
                            };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                          }
                        }
                      }
                    }
                  } else {
                    const err4 = {
                      instancePath: instancePath + "/checkpoint",
                      schemaPath: "#/$defs/Checkpoint/oneOf/0/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors++;
                  }
                }
                var _valid0 = _errs12 === errors;
                if (_valid0) {
                  valid4 = true;
                  passing0 = 0;
                  var props0 = true;
                }
                const _errs17 = errors;
                if (errors === _errs17) {
                  if (
                    data3 &&
                    typeof data3 == "object" &&
                    !Array.isArray(data3)
                  ) {
                    let missing2;
                    if (
                      (data3.kind === undefined && (missing2 = "kind")) ||
                      (data3.commit === undefined && (missing2 = "commit"))
                    ) {
                      const err5 = {
                        instancePath: instancePath + "/checkpoint",
                        schemaPath: "#/$defs/Checkpoint/oneOf/1/required",
                        keyword: "required",
                        params: { missingProperty: missing2 },
                        message:
                          "must have required property '" + missing2 + "'",
                      };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors++;
                    } else {
                      const _errs19 = errors;
                      for (const key2 in data3) {
                        if (!(key2 === "commit" || key2 === "kind")) {
                          const err6 = {
                            instancePath: instancePath + "/checkpoint",
                            schemaPath:
                              "#/$defs/Checkpoint/oneOf/1/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key2 },
                            message: "must NOT have additional properties",
                          };
                          if (vErrors === null) {
                            vErrors = [err6];
                          } else {
                            vErrors.push(err6);
                          }
                          errors++;
                          break;
                        }
                      }
                      if (_errs19 === errors) {
                        if (data3.commit !== undefined) {
                          const _errs20 = errors;
                          if (typeof data3.commit !== "string") {
                            const err7 = {
                              instancePath: instancePath + "/checkpoint/commit",
                              schemaPath:
                                "#/$defs/Checkpoint/oneOf/1/properties/commit/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            };
                            if (vErrors === null) {
                              vErrors = [err7];
                            } else {
                              vErrors.push(err7);
                            }
                            errors++;
                          }
                          var valid6 = _errs20 === errors;
                        } else {
                          var valid6 = true;
                        }
                        if (valid6) {
                          if (data3.kind !== undefined) {
                            let data6 = data3.kind;
                            const _errs22 = errors;
                            if (typeof data6 !== "string") {
                              const err8 = {
                                instancePath: instancePath + "/checkpoint/kind",
                                schemaPath:
                                  "#/$defs/Checkpoint/oneOf/1/properties/kind/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err8];
                              } else {
                                vErrors.push(err8);
                              }
                              errors++;
                            }
                            if ("git" !== data6) {
                              const err9 = {
                                instancePath: instancePath + "/checkpoint/kind",
                                schemaPath:
                                  "#/$defs/Checkpoint/oneOf/1/properties/kind/const",
                                keyword: "const",
                                params: { allowedValue: "git" },
                                message: "must be equal to constant",
                              };
                              if (vErrors === null) {
                                vErrors = [err9];
                              } else {
                                vErrors.push(err9);
                              }
                              errors++;
                            }
                            var valid6 = _errs22 === errors;
                          } else {
                            var valid6 = true;
                          }
                        }
                      }
                    }
                  } else {
                    const err10 = {
                      instancePath: instancePath + "/checkpoint",
                      schemaPath: "#/$defs/Checkpoint/oneOf/1/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    };
                    if (vErrors === null) {
                      vErrors = [err10];
                    } else {
                      vErrors.push(err10);
                    }
                    errors++;
                  }
                }
                var _valid0 = _errs17 === errors;
                if (_valid0 && valid4) {
                  valid4 = false;
                  passing0 = [passing0, 1];
                } else {
                  if (_valid0) {
                    valid4 = true;
                    passing0 = 1;
                    if (props0 !== true) {
                      props0 = true;
                    }
                  }
                }
                if (!valid4) {
                  const err11 = {
                    instancePath: instancePath + "/checkpoint",
                    schemaPath: "#/$defs/Checkpoint/oneOf",
                    keyword: "oneOf",
                    params: { passingSchemas: passing0 },
                    message: "must match exactly one schema in oneOf",
                  };
                  if (vErrors === null) {
                    vErrors = [err11];
                  } else {
                    vErrors.push(err11);
                  }
                  errors++;
                  validate44.errors = vErrors;
                  return false;
                } else {
                  errors = _errs11;
                  if (vErrors !== null) {
                    if (_errs11) {
                      vErrors.length = _errs11;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid0 = _errs9 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.created_at !== undefined) {
                  let data7 = data.created_at;
                  const _errs24 = errors;
                  if (
                    !(typeof data7 == "number" && !(data7 % 1) && !isNaN(data7))
                  ) {
                    validate44.errors = [
                      {
                        instancePath: instancePath + "/created_at",
                        schemaPath: "#/properties/created_at/type",
                        keyword: "type",
                        params: { type: "integer" },
                        message: "must be integer",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs24 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.dependencies !== undefined) {
                    let data8 = data.dependencies;
                    const _errs26 = errors;
                    if (errors === _errs26) {
                      if (Array.isArray(data8)) {
                        var valid7 = true;
                        const len1 = data8.length;
                        for (let i1 = 0; i1 < len1; i1++) {
                          const _errs28 = errors;
                          if (typeof data8[i1] !== "string") {
                            validate44.errors = [
                              {
                                instancePath:
                                  instancePath + "/dependencies/" + i1,
                                schemaPath:
                                  "#/properties/dependencies/items/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          var valid7 = _errs28 === errors;
                          if (!valid7) {
                            break;
                          }
                        }
                      } else {
                        validate44.errors = [
                          {
                            instancePath: instancePath + "/dependencies",
                            schemaPath: "#/properties/dependencies/type",
                            keyword: "type",
                            params: { type: "array" },
                            message: "must be array",
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs26 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.feature !== undefined) {
                      const _errs30 = errors;
                      if (typeof data.feature !== "string") {
                        validate44.errors = [
                          {
                            instancePath: instancePath + "/feature",
                            schemaPath: "#/properties/feature/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs30 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.id !== undefined) {
                        const _errs32 = errors;
                        if (typeof data.id !== "string") {
                          validate44.errors = [
                            {
                              instancePath: instancePath + "/id",
                              schemaPath: "#/properties/id/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        var valid0 = _errs32 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.last_progress !== undefined) {
                          let data12 = data.last_progress;
                          const _errs34 = errors;
                          if (
                            !(
                              typeof data12 == "number" &&
                              !(data12 % 1) &&
                              !isNaN(data12)
                            )
                          ) {
                            validate44.errors = [
                              {
                                instancePath: instancePath + "/last_progress",
                                schemaPath: "#/properties/last_progress/type",
                                keyword: "type",
                                params: { type: "integer" },
                                message: "must be integer",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs34 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.last_update !== undefined) {
                            let data13 = data.last_update;
                            const _errs36 = errors;
                            if (
                              !(
                                typeof data13 == "number" &&
                                !(data13 % 1) &&
                                !isNaN(data13)
                              )
                            ) {
                              validate44.errors = [
                                {
                                  instancePath: instancePath + "/last_update",
                                  schemaPath: "#/properties/last_update/type",
                                  keyword: "type",
                                  params: { type: "integer" },
                                  message: "must be integer",
                                },
                              ];
                              return false;
                            }
                            var valid0 = _errs36 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.objective !== undefined) {
                              const _errs38 = errors;
                              if (typeof data.objective !== "string") {
                                validate44.errors = [
                                  {
                                    instancePath: instancePath + "/objective",
                                    schemaPath: "#/$defs/Note/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                              var valid0 = _errs38 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.progress !== undefined) {
                                const _errs41 = errors;
                                if (
                                  !validate45(data.progress, {
                                    instancePath: instancePath + "/progress",
                                    parentData: data,
                                    parentDataProperty: "progress",
                                    rootData,
                                    dynamicAnchors,
                                  })
                                ) {
                                  vErrors =
                                    vErrors === null
                                      ? validate45.errors
                                      : vErrors.concat(validate45.errors);
                                  errors = vErrors.length;
                                }
                                var valid0 = _errs41 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.revision !== undefined) {
                                  let data16 = data.revision;
                                  const _errs42 = errors;
                                  if (
                                    !(
                                      typeof data16 == "number" &&
                                      !(data16 % 1) &&
                                      !isNaN(data16)
                                    )
                                  ) {
                                    validate44.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/revision",
                                        schemaPath:
                                          "#/properties/revision/type",
                                        keyword: "type",
                                        params: { type: "integer" },
                                        message: "must be integer",
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid0 = _errs42 === errors;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.state !== undefined) {
                                    const _errs44 = errors;
                                    if (
                                      !validate49(data.state, {
                                        instancePath: instancePath + "/state",
                                        parentData: data,
                                        parentDataProperty: "state",
                                        rootData,
                                        dynamicAnchors,
                                      })
                                    ) {
                                      vErrors =
                                        vErrors === null
                                          ? validate49.errors
                                          : vErrors.concat(validate49.errors);
                                      errors = vErrors.length;
                                    }
                                    var valid0 = _errs44 === errors;
                                  } else {
                                    var valid0 = true;
                                  }
                                  if (valid0) {
                                    if (data.version !== undefined) {
                                      let data18 = data.version;
                                      const _errs45 = errors;
                                      if (
                                        !(
                                          typeof data18 == "number" &&
                                          !(data18 % 1) &&
                                          !isNaN(data18)
                                        )
                                      ) {
                                        validate44.errors = [
                                          {
                                            instancePath:
                                              instancePath + "/version",
                                            schemaPath:
                                              "#/properties/version/type",
                                            keyword: "type",
                                            params: { type: "integer" },
                                            message: "must be integer",
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid0 = _errs45 === errors;
                                    } else {
                                      var valid0 = true;
                                    }
                                    if (valid0) {
                                      if (data.workspace !== undefined) {
                                        let data19 = data.workspace;
                                        const _errs47 = errors;
                                        const _errs49 = errors;
                                        let valid10 = false;
                                        let passing1 = null;
                                        const _errs50 = errors;
                                        if (errors === _errs50) {
                                          if (
                                            data19 &&
                                            typeof data19 == "object" &&
                                            !Array.isArray(data19)
                                          ) {
                                            let missing3;
                                            if (
                                              data19.kind === undefined &&
                                              (missing3 = "kind")
                                            ) {
                                              const err12 = {
                                                instancePath:
                                                  instancePath + "/workspace",
                                                schemaPath:
                                                  "#/$defs/Workspace/oneOf/0/required",
                                                keyword: "required",
                                                params: {
                                                  missingProperty: missing3,
                                                },
                                                message:
                                                  "must have required property '" +
                                                  missing3 +
                                                  "'",
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err12];
                                              } else {
                                                vErrors.push(err12);
                                              }
                                              errors++;
                                            } else {
                                              const _errs52 = errors;
                                              for (const key3 in data19) {
                                                if (!(key3 === "kind")) {
                                                  const err13 = {
                                                    instancePath:
                                                      instancePath +
                                                      "/workspace",
                                                    schemaPath:
                                                      "#/$defs/Workspace/oneOf/0/additionalProperties",
                                                    keyword:
                                                      "additionalProperties",
                                                    params: {
                                                      additionalProperty: key3,
                                                    },
                                                    message:
                                                      "must NOT have additional properties",
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err13];
                                                  } else {
                                                    vErrors.push(err13);
                                                  }
                                                  errors++;
                                                  break;
                                                }
                                              }
                                              if (_errs52 === errors) {
                                                if (data19.kind !== undefined) {
                                                  let data20 = data19.kind;
                                                  if (
                                                    typeof data20 !== "string"
                                                  ) {
                                                    const err14 = {
                                                      instancePath:
                                                        instancePath +
                                                        "/workspace/kind",
                                                      schemaPath:
                                                        "#/$defs/Workspace/oneOf/0/properties/kind/type",
                                                      keyword: "type",
                                                      params: {
                                                        type: "string",
                                                      },
                                                      message: "must be string",
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err14];
                                                    } else {
                                                      vErrors.push(err14);
                                                    }
                                                    errors++;
                                                  }
                                                  if ("read_only" !== data20) {
                                                    const err15 = {
                                                      instancePath:
                                                        instancePath +
                                                        "/workspace/kind",
                                                      schemaPath:
                                                        "#/$defs/Workspace/oneOf/0/properties/kind/const",
                                                      keyword: "const",
                                                      params: {
                                                        allowedValue:
                                                          "read_only",
                                                      },
                                                      message:
                                                        "must be equal to constant",
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err15];
                                                    } else {
                                                      vErrors.push(err15);
                                                    }
                                                    errors++;
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            const err16 = {
                                              instancePath:
                                                instancePath + "/workspace",
                                              schemaPath:
                                                "#/$defs/Workspace/oneOf/0/type",
                                              keyword: "type",
                                              params: { type: "object" },
                                              message: "must be object",
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err16];
                                            } else {
                                              vErrors.push(err16);
                                            }
                                            errors++;
                                          }
                                        }
                                        var _valid1 = _errs50 === errors;
                                        if (_valid1) {
                                          valid10 = true;
                                          passing1 = 0;
                                          var props2 = true;
                                        }
                                        const _errs55 = errors;
                                        if (errors === _errs55) {
                                          if (
                                            data19 &&
                                            typeof data19 == "object" &&
                                            !Array.isArray(data19)
                                          ) {
                                            let missing4;
                                            if (
                                              (data19.kind === undefined &&
                                                (missing4 = "kind")) ||
                                              (data19.branch === undefined &&
                                                (missing4 = "branch")) ||
                                              (data19.path === undefined &&
                                                (missing4 = "path"))
                                            ) {
                                              const err17 = {
                                                instancePath:
                                                  instancePath + "/workspace",
                                                schemaPath:
                                                  "#/$defs/Workspace/oneOf/1/required",
                                                keyword: "required",
                                                params: {
                                                  missingProperty: missing4,
                                                },
                                                message:
                                                  "must have required property '" +
                                                  missing4 +
                                                  "'",
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err17];
                                              } else {
                                                vErrors.push(err17);
                                              }
                                              errors++;
                                            } else {
                                              const _errs57 = errors;
                                              for (const key4 in data19) {
                                                if (
                                                  !(
                                                    key4 === "branch" ||
                                                    key4 === "kind" ||
                                                    key4 === "path"
                                                  )
                                                ) {
                                                  const err18 = {
                                                    instancePath:
                                                      instancePath +
                                                      "/workspace",
                                                    schemaPath:
                                                      "#/$defs/Workspace/oneOf/1/additionalProperties",
                                                    keyword:
                                                      "additionalProperties",
                                                    params: {
                                                      additionalProperty: key4,
                                                    },
                                                    message:
                                                      "must NOT have additional properties",
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err18];
                                                  } else {
                                                    vErrors.push(err18);
                                                  }
                                                  errors++;
                                                  break;
                                                }
                                              }
                                              if (_errs57 === errors) {
                                                if (
                                                  data19.branch !== undefined
                                                ) {
                                                  const _errs58 = errors;
                                                  if (
                                                    typeof data19.branch !==
                                                    "string"
                                                  ) {
                                                    const err19 = {
                                                      instancePath:
                                                        instancePath +
                                                        "/workspace/branch",
                                                      schemaPath:
                                                        "#/$defs/Workspace/oneOf/1/properties/branch/type",
                                                      keyword: "type",
                                                      params: {
                                                        type: "string",
                                                      },
                                                      message: "must be string",
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err19];
                                                    } else {
                                                      vErrors.push(err19);
                                                    }
                                                    errors++;
                                                  }
                                                  var valid12 =
                                                    _errs58 === errors;
                                                } else {
                                                  var valid12 = true;
                                                }
                                                if (valid12) {
                                                  if (
                                                    data19.kind !== undefined
                                                  ) {
                                                    let data22 = data19.kind;
                                                    const _errs60 = errors;
                                                    if (
                                                      typeof data22 !== "string"
                                                    ) {
                                                      const err20 = {
                                                        instancePath:
                                                          instancePath +
                                                          "/workspace/kind",
                                                        schemaPath:
                                                          "#/$defs/Workspace/oneOf/1/properties/kind/type",
                                                        keyword: "type",
                                                        params: {
                                                          type: "string",
                                                        },
                                                        message:
                                                          "must be string",
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err20];
                                                      } else {
                                                        vErrors.push(err20);
                                                      }
                                                      errors++;
                                                    }
                                                    if ("git" !== data22) {
                                                      const err21 = {
                                                        instancePath:
                                                          instancePath +
                                                          "/workspace/kind",
                                                        schemaPath:
                                                          "#/$defs/Workspace/oneOf/1/properties/kind/const",
                                                        keyword: "const",
                                                        params: {
                                                          allowedValue: "git",
                                                        },
                                                        message:
                                                          "must be equal to constant",
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err21];
                                                      } else {
                                                        vErrors.push(err21);
                                                      }
                                                      errors++;
                                                    }
                                                    var valid12 =
                                                      _errs60 === errors;
                                                  } else {
                                                    var valid12 = true;
                                                  }
                                                  if (valid12) {
                                                    if (
                                                      data19.path !== undefined
                                                    ) {
                                                      const _errs62 = errors;
                                                      if (
                                                        typeof data19.path !==
                                                        "string"
                                                      ) {
                                                        const err22 = {
                                                          instancePath:
                                                            instancePath +
                                                            "/workspace/path",
                                                          schemaPath:
                                                            "#/$defs/Workspace/oneOf/1/properties/path/type",
                                                          keyword: "type",
                                                          params: {
                                                            type: "string",
                                                          },
                                                          message:
                                                            "must be string",
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err22];
                                                        } else {
                                                          vErrors.push(err22);
                                                        }
                                                        errors++;
                                                      }
                                                      var valid12 =
                                                        _errs62 === errors;
                                                    } else {
                                                      var valid12 = true;
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            const err23 = {
                                              instancePath:
                                                instancePath + "/workspace",
                                              schemaPath:
                                                "#/$defs/Workspace/oneOf/1/type",
                                              keyword: "type",
                                              params: { type: "object" },
                                              message: "must be object",
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err23];
                                            } else {
                                              vErrors.push(err23);
                                            }
                                            errors++;
                                          }
                                        }
                                        var _valid1 = _errs55 === errors;
                                        if (_valid1 && valid10) {
                                          valid10 = false;
                                          passing1 = [passing1, 1];
                                        } else {
                                          if (_valid1) {
                                            valid10 = true;
                                            passing1 = 1;
                                            if (props2 !== true) {
                                              props2 = true;
                                            }
                                          }
                                        }
                                        if (!valid10) {
                                          const err24 = {
                                            instancePath:
                                              instancePath + "/workspace",
                                            schemaPath:
                                              "#/$defs/Workspace/oneOf",
                                            keyword: "oneOf",
                                            params: {
                                              passingSchemas: passing1,
                                            },
                                            message:
                                              "must match exactly one schema in oneOf",
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err24];
                                          } else {
                                            vErrors.push(err24);
                                          }
                                          errors++;
                                          validate44.errors = vErrors;
                                          return false;
                                        } else {
                                          errors = _errs49;
                                          if (vErrors !== null) {
                                            if (_errs49) {
                                              vErrors.length = _errs49;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid0 = _errs47 === errors;
                                      } else {
                                        var valid0 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate44.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate44.errors = vErrors;
  return errors === 0;
}
validate44.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate32(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.task === undefined && (missing0 = "task")) ||
        (data.created_by === undefined && (missing0 = "created_by")) ||
        (data.worker === undefined && (missing0 = "worker")) ||
        (data.checkpoints === undefined && (missing0 = "checkpoints")) ||
        (data.integrations === undefined && (missing0 = "integrations")) ||
        (data.milestones === undefined && (missing0 = "milestones")) ||
        (data.history_end === undefined && (missing0 = "history_end"))
      ) {
        validate32.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.checkpoints !== undefined) {
          let data0 = data.checkpoints;
          const _errs1 = errors;
          if (errors === _errs1) {
            if (Array.isArray(data0)) {
              var valid1 = true;
              const len0 = data0.length;
              for (let i0 = 0; i0 < len0; i0++) {
                const _errs3 = errors;
                if (
                  !validate33(data0[i0], {
                    instancePath: instancePath + "/checkpoints/" + i0,
                    parentData: data0,
                    parentDataProperty: i0,
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null
                      ? validate33.errors
                      : vErrors.concat(validate33.errors);
                  errors = vErrors.length;
                }
                var valid1 = _errs3 === errors;
                if (!valid1) {
                  break;
                }
              }
            } else {
              validate32.errors = [
                {
                  instancePath: instancePath + "/checkpoints",
                  schemaPath: "#/properties/checkpoints/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                },
              ];
              return false;
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.created_by !== undefined) {
            const _errs4 = errors;
            if (
              !validate37(data.created_by, {
                instancePath: instancePath + "/created_by",
                parentData: data,
                parentDataProperty: "created_by",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate37.errors
                  : vErrors.concat(validate37.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.history_end !== undefined) {
              let data3 = data.history_end;
              const _errs5 = errors;
              if (typeof data3 !== "string") {
                validate32.errors = [
                  {
                    instancePath: instancePath + "/history_end",
                    schemaPath: "#/$defs/PageEnd/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              if (!(data3 === "Complete" || data3 === "More")) {
                validate32.errors = [
                  {
                    instancePath: instancePath + "/history_end",
                    schemaPath: "#/$defs/PageEnd/enum",
                    keyword: "enum",
                    params: { allowedValues: schema35.enum },
                    message: "must be equal to one of the allowed values",
                  },
                ];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.integrations !== undefined) {
                let data4 = data.integrations;
                const _errs8 = errors;
                if (errors === _errs8) {
                  if (Array.isArray(data4)) {
                    var valid3 = true;
                    const len1 = data4.length;
                    for (let i1 = 0; i1 < len1; i1++) {
                      const _errs10 = errors;
                      if (
                        !validate33(data4[i1], {
                          instancePath: instancePath + "/integrations/" + i1,
                          parentData: data4,
                          parentDataProperty: i1,
                          rootData,
                          dynamicAnchors,
                        })
                      ) {
                        vErrors =
                          vErrors === null
                            ? validate33.errors
                            : vErrors.concat(validate33.errors);
                        errors = vErrors.length;
                      }
                      var valid3 = _errs10 === errors;
                      if (!valid3) {
                        break;
                      }
                    }
                  } else {
                    validate32.errors = [
                      {
                        instancePath: instancePath + "/integrations",
                        schemaPath: "#/properties/integrations/type",
                        keyword: "type",
                        params: { type: "array" },
                        message: "must be array",
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs8 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.milestones !== undefined) {
                  let data6 = data.milestones;
                  const _errs11 = errors;
                  if (errors === _errs11) {
                    if (Array.isArray(data6)) {
                      var valid4 = true;
                      const len2 = data6.length;
                      for (let i2 = 0; i2 < len2; i2++) {
                        const _errs13 = errors;
                        if (
                          !validate41(data6[i2], {
                            instancePath: instancePath + "/milestones/" + i2,
                            parentData: data6,
                            parentDataProperty: i2,
                            rootData,
                            dynamicAnchors,
                          })
                        ) {
                          vErrors =
                            vErrors === null
                              ? validate41.errors
                              : vErrors.concat(validate41.errors);
                          errors = vErrors.length;
                        }
                        var valid4 = _errs13 === errors;
                        if (!valid4) {
                          break;
                        }
                      }
                    } else {
                      validate32.errors = [
                        {
                          instancePath: instancePath + "/milestones",
                          schemaPath: "#/properties/milestones/type",
                          keyword: "type",
                          params: { type: "array" },
                          message: "must be array",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs11 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.task !== undefined) {
                    const _errs14 = errors;
                    if (
                      !validate44(data.task, {
                        instancePath: instancePath + "/task",
                        parentData: data,
                        parentDataProperty: "task",
                        rootData,
                        dynamicAnchors,
                      })
                    ) {
                      vErrors =
                        vErrors === null
                          ? validate44.errors
                          : vErrors.concat(validate44.errors);
                      errors = vErrors.length;
                    }
                    var valid0 = _errs14 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.worker !== undefined) {
                      const _errs15 = errors;
                      if (
                        !validate37(data.worker, {
                          instancePath: instancePath + "/worker",
                          parentData: data,
                          parentDataProperty: "worker",
                          rootData,
                          dynamicAnchors,
                        })
                      ) {
                        vErrors =
                          vErrors === null
                            ? validate37.errors
                            : vErrors.concat(validate37.errors);
                        errors = vErrors.length;
                      }
                      var valid0 = _errs15 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate32.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate32.errors = vErrors;
  return errors === 0;
}
validate32.evaluated = {
  props: {
    checkpoints: true,
    created_by: true,
    history_end: true,
    integrations: true,
    milestones: true,
    task: true,
    worker: true,
  },
  dynamicProps: false,
  dynamicItems: false,
};
function validate31(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.records === undefined && (missing0 = "records")) ||
        (data.end === undefined && (missing0 = "end"))
      ) {
        validate31.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.end !== undefined) {
          let data0 = data.end;
          const _errs1 = errors;
          if (typeof data0 !== "string") {
            validate31.errors = [
              {
                instancePath: instancePath + "/end",
                schemaPath: "#/$defs/PageEnd/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              },
            ];
            return false;
          }
          if (!(data0 === "Complete" || data0 === "More")) {
            validate31.errors = [
              {
                instancePath: instancePath + "/end",
                schemaPath: "#/$defs/PageEnd/enum",
                keyword: "enum",
                params: { allowedValues: schema35.enum },
                message: "must be equal to one of the allowed values",
              },
            ];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.records !== undefined) {
            let data1 = data.records;
            const _errs4 = errors;
            if (errors === _errs4) {
              if (Array.isArray(data1)) {
                var valid2 = true;
                const len0 = data1.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs6 = errors;
                  if (
                    !validate32(data1[i0], {
                      instancePath: instancePath + "/records/" + i0,
                      parentData: data1,
                      parentDataProperty: i0,
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate32.errors
                        : vErrors.concat(validate32.errors);
                    errors = vErrors.length;
                  }
                  var valid2 = _errs6 === errors;
                  if (!valid2) {
                    break;
                  }
                }
              } else {
                validate31.errors = [
                  {
                    instancePath: instancePath + "/records",
                    schemaPath: "#/properties/records/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
        }
      }
    } else {
      validate31.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate31.errors = vErrors;
  return errors === 0;
}
validate31.evaluated = {
  props: { end: true, records: true },
  dynamicProps: false,
  dynamicItems: false,
};
function validate27(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.feature === undefined && (missing0 = "feature")) ||
        (data.counts === undefined && (missing0 = "counts")) ||
        (data.tasks === undefined && (missing0 = "tasks")) ||
        (data.observed_at === undefined && (missing0 = "observed_at"))
      ) {
        validate27.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.counts !== undefined) {
          let data0 = data.counts;
          const _errs1 = errors;
          if (errors === _errs1) {
            if (Array.isArray(data0)) {
              var valid1 = true;
              const len0 = data0.length;
              for (let i0 = 0; i0 < len0; i0++) {
                const _errs3 = errors;
                if (
                  !validate28(data0[i0], {
                    instancePath: instancePath + "/counts/" + i0,
                    parentData: data0,
                    parentDataProperty: i0,
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null
                      ? validate28.errors
                      : vErrors.concat(validate28.errors);
                  errors = vErrors.length;
                }
                var valid1 = _errs3 === errors;
                if (!valid1) {
                  break;
                }
              }
            } else {
              validate27.errors = [
                {
                  instancePath: instancePath + "/counts",
                  schemaPath: "#/properties/counts/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                },
              ];
              return false;
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.feature !== undefined) {
            const _errs4 = errors;
            if (
              !validate24(data.feature, {
                instancePath: instancePath + "/feature",
                parentData: data,
                parentDataProperty: "feature",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate24.errors
                  : vErrors.concat(validate24.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.observed_at !== undefined) {
              let data3 = data.observed_at;
              const _errs5 = errors;
              if (
                !(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))
              ) {
                validate27.errors = [
                  {
                    instancePath: instancePath + "/observed_at",
                    schemaPath: "#/properties/observed_at/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  },
                ];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.tasks !== undefined) {
                const _errs7 = errors;
                if (
                  !validate31(data.tasks, {
                    instancePath: instancePath + "/tasks",
                    parentData: data,
                    parentDataProperty: "tasks",
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null
                      ? validate31.errors
                      : vErrors.concat(validate31.errors);
                  errors = vErrors.length;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate27.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate27.errors = vErrors;
  return errors === 0;
}
validate27.evaluated = {
  props: { counts: true, feature: true, observed_at: true, tasks: true },
  dynamicProps: false,
  dynamicItems: false,
};
const schema75 = {
  description:
    "A page of at most 100 records. Each operation releases its connection before returning.",
  properties: {
    end: { $ref: "#/$defs/PageEnd" },
    records: { items: { $ref: "#/$defs/Event" }, type: "array" },
  },
  required: ["records", "end"],
  type: "object",
};
const schema77 = {
  additionalProperties: false,
  properties: {
    actor: { $ref: "#/$defs/AgentId" },
    kind: { $ref: "#/$defs/EventKind" },
    note: { $ref: "#/$defs/Note" },
    task: { $ref: "#/$defs/Task" },
    version: { format: "int64", type: "integer" },
  },
  required: ["version", "kind", "actor", "note", "task"],
  type: "object",
};
function validate64(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate64.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.version === undefined && (missing0 = "version")) ||
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.actor === undefined && (missing0 = "actor")) ||
        (data.note === undefined && (missing0 = "note")) ||
        (data.task === undefined && (missing0 = "task"))
      ) {
        validate64.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "actor" ||
              key0 === "kind" ||
              key0 === "note" ||
              key0 === "task" ||
              key0 === "version"
            )
          ) {
            validate64.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.actor !== undefined) {
            const _errs2 = errors;
            if (
              !validate34(data.actor, {
                instancePath: instancePath + "/actor",
                parentData: data,
                parentDataProperty: "actor",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate34.errors
                  : vErrors.concat(validate34.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.kind !== undefined) {
              let data1 = data.kind;
              const _errs3 = errors;
              if (typeof data1 !== "string") {
                validate64.errors = [
                  {
                    instancePath: instancePath + "/kind",
                    schemaPath: "#/$defs/EventKind/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              if (
                !(
                  data1 === "created" ||
                  data1 === "claimed" ||
                  data1 === "heartbeat" ||
                  data1 === "progress" ||
                  data1 === "checkpoint" ||
                  data1 === "ready" ||
                  data1 === "integrated" ||
                  data1 === "requeued" ||
                  data1 === "cancelled"
                )
              ) {
                validate64.errors = [
                  {
                    instancePath: instancePath + "/kind",
                    schemaPath: "#/$defs/EventKind/enum",
                    keyword: "enum",
                    params: { allowedValues: schema55.enum },
                    message: "must be equal to one of the allowed values",
                  },
                ];
                return false;
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.note !== undefined) {
                const _errs6 = errors;
                if (typeof data.note !== "string") {
                  validate64.errors = [
                    {
                      instancePath: instancePath + "/note",
                      schemaPath: "#/$defs/Note/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.task !== undefined) {
                  const _errs9 = errors;
                  if (
                    !validate44(data.task, {
                      instancePath: instancePath + "/task",
                      parentData: data,
                      parentDataProperty: "task",
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate44.errors
                        : vErrors.concat(validate44.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.version !== undefined) {
                    let data4 = data.version;
                    const _errs10 = errors;
                    if (
                      !(
                        typeof data4 == "number" &&
                        !(data4 % 1) &&
                        !isNaN(data4)
                      )
                    ) {
                      validate64.errors = [
                        {
                          instancePath: instancePath + "/version",
                          schemaPath: "#/properties/version/type",
                          keyword: "type",
                          params: { type: "integer" },
                          message: "must be integer",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate64.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate64.errors = vErrors;
  return errors === 0;
}
validate64.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate63(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate63.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.records === undefined && (missing0 = "records")) ||
        (data.end === undefined && (missing0 = "end"))
      ) {
        validate63.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.end !== undefined) {
          let data0 = data.end;
          const _errs1 = errors;
          if (typeof data0 !== "string") {
            validate63.errors = [
              {
                instancePath: instancePath + "/end",
                schemaPath: "#/$defs/PageEnd/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              },
            ];
            return false;
          }
          if (!(data0 === "Complete" || data0 === "More")) {
            validate63.errors = [
              {
                instancePath: instancePath + "/end",
                schemaPath: "#/$defs/PageEnd/enum",
                keyword: "enum",
                params: { allowedValues: schema35.enum },
                message: "must be equal to one of the allowed values",
              },
            ];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.records !== undefined) {
            let data1 = data.records;
            const _errs4 = errors;
            if (errors === _errs4) {
              if (Array.isArray(data1)) {
                var valid2 = true;
                const len0 = data1.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs6 = errors;
                  if (
                    !validate64(data1[i0], {
                      instancePath: instancePath + "/records/" + i0,
                      parentData: data1,
                      parentDataProperty: i0,
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate64.errors
                        : vErrors.concat(validate64.errors);
                    errors = vErrors.length;
                  }
                  var valid2 = _errs6 === errors;
                  if (!valid2) {
                    break;
                  }
                }
              } else {
                validate63.errors = [
                  {
                    instancePath: instancePath + "/records",
                    schemaPath: "#/properties/records/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
        }
      }
    } else {
      validate63.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate63.errors = vErrors;
  return errors === 0;
}
validate63.evaluated = {
  props: { end: true, records: true },
  dynamicProps: false,
  dynamicItems: false,
};
function validate22(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.value === undefined && (missing0 = "value"))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        if (data.kind !== undefined) {
          let data0 = data.kind;
          const _errs3 = errors;
          if (typeof data0 !== "string") {
            const err1 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/0/properties/kind/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
          if ("Features" !== data0) {
            const err2 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/0/properties/kind/const",
              keyword: "const",
              params: { allowedValue: "Features" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
          var valid1 = _errs3 === errors;
        } else {
          var valid1 = true;
        }
        if (valid1) {
          if (data.value !== undefined) {
            const _errs5 = errors;
            if (
              !validate23(data.value, {
                instancePath: instancePath + "/value",
                parentData: data,
                parentDataProperty: "value",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate23.errors
                  : vErrors.concat(validate23.errors);
              errors = vErrors.length;
            }
            var valid1 = _errs5 === errors;
          } else {
            var valid1 = true;
          }
        }
      }
    } else {
      const err3 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = {};
    props0.kind = true;
    props0.value = true;
  }
  const _errs6 = errors;
  if (errors === _errs6) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (
        (data.kind === undefined && (missing1 = "kind")) ||
        (data.value === undefined && (missing1 = "value"))
      ) {
        const err4 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing1 },
          message: "must have required property '" + missing1 + "'",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      } else {
        if (data.kind !== undefined) {
          let data2 = data.kind;
          const _errs8 = errors;
          if (typeof data2 !== "string") {
            const err5 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/1/properties/kind/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
          if ("Workflow" !== data2) {
            const err6 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/1/properties/kind/const",
              keyword: "const",
              params: { allowedValue: "Workflow" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
          var valid2 = _errs8 === errors;
        } else {
          var valid2 = true;
        }
        if (valid2) {
          if (data.value !== undefined) {
            const _errs10 = errors;
            if (
              !validate27(data.value, {
                instancePath: instancePath + "/value",
                parentData: data,
                parentDataProperty: "value",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate27.errors
                  : vErrors.concat(validate27.errors);
              errors = vErrors.length;
            }
            var valid2 = _errs10 === errors;
          } else {
            var valid2 = true;
          }
        }
      }
    } else {
      const err7 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = props0 || {};
        props0.kind = true;
        props0.value = true;
      }
    }
    const _errs11 = errors;
    if (errors === _errs11) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (
          (data.kind === undefined && (missing2 = "kind")) ||
          (data.value === undefined && (missing2 = "value"))
        ) {
          const err8 = {
            instancePath,
            schemaPath: "#/oneOf/2/required",
            keyword: "required",
            params: { missingProperty: missing2 },
            message: "must have required property '" + missing2 + "'",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        } else {
          if (data.kind !== undefined) {
            let data4 = data.kind;
            const _errs13 = errors;
            if (typeof data4 !== "string") {
              const err9 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/2/properties/kind/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
            if ("Task" !== data4) {
              const err10 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/2/properties/kind/const",
                keyword: "const",
                params: { allowedValue: "Task" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
            var valid3 = _errs13 === errors;
          } else {
            var valid3 = true;
          }
          if (valid3) {
            if (data.value !== undefined) {
              const _errs15 = errors;
              if (
                !validate44(data.value, {
                  instancePath: instancePath + "/value",
                  parentData: data,
                  parentDataProperty: "value",
                  rootData,
                  dynamicAnchors,
                })
              ) {
                vErrors =
                  vErrors === null
                    ? validate44.errors
                    : vErrors.concat(validate44.errors);
                errors = vErrors.length;
              }
              var valid3 = _errs15 === errors;
            } else {
              var valid3 = true;
            }
          }
        }
      } else {
        const err11 = {
          instancePath,
          schemaPath: "#/oneOf/2/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    var _valid0 = _errs11 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = props0 || {};
          props0.kind = true;
          props0.value = true;
        }
      }
      const _errs16 = errors;
      if (errors === _errs16) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing3;
          if (
            (data.kind === undefined && (missing3 = "kind")) ||
            (data.value === undefined && (missing3 = "value"))
          ) {
            const err12 = {
              instancePath,
              schemaPath: "#/oneOf/3/required",
              keyword: "required",
              params: { missingProperty: missing3 },
              message: "must have required property '" + missing3 + "'",
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          } else {
            if (data.kind !== undefined) {
              let data6 = data.kind;
              const _errs18 = errors;
              if (typeof data6 !== "string") {
                const err13 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/3/properties/kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err13];
                } else {
                  vErrors.push(err13);
                }
                errors++;
              }
              if ("History" !== data6) {
                const err14 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/3/properties/kind/const",
                  keyword: "const",
                  params: { allowedValue: "History" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err14];
                } else {
                  vErrors.push(err14);
                }
                errors++;
              }
              var valid4 = _errs18 === errors;
            } else {
              var valid4 = true;
            }
            if (valid4) {
              if (data.value !== undefined) {
                const _errs20 = errors;
                if (
                  !validate63(data.value, {
                    instancePath: instancePath + "/value",
                    parentData: data,
                    parentDataProperty: "value",
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null
                      ? validate63.errors
                      : vErrors.concat(validate63.errors);
                  errors = vErrors.length;
                }
                var valid4 = _errs20 === errors;
              } else {
                var valid4 = true;
              }
            }
          }
        } else {
          const err15 = {
            instancePath,
            schemaPath: "#/oneOf/3/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      }
      var _valid0 = _errs16 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = props0 || {};
            props0.kind = true;
            props0.value = true;
          }
        }
      }
    }
  }
  if (!valid0) {
    const err16 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err16];
    } else {
      vErrors.push(err16);
    }
    errors++;
    validate22.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate22.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate22.evaluated = { dynamicProps: true, dynamicItems: false };
const schema80 = {
  properties: {
    page: { format: "uint32", minimum: 0, type: "integer" },
    view: { $ref: "#/$defs/DashboardView" },
  },
  required: ["view", "page"],
  type: "object",
};
const schema81 = {
  oneOf: [
    {
      additionalProperties: false,
      properties: { kind: { const: "Features", type: "string" } },
      required: ["kind"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        feature: { type: "string" },
        kind: { const: "Tasks", type: "string" },
      },
      required: ["kind", "feature"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        kind: { const: "Task", type: "string" },
        query: { $ref: "#/$defs/TaskQuery" },
      },
      required: ["kind", "query"],
      type: "object",
    },
    {
      additionalProperties: false,
      properties: {
        kind: { const: "History", type: "string" },
        query: { $ref: "#/$defs/TaskQuery" },
      },
      required: ["kind", "query"],
      type: "object",
    },
  ],
};
const schema82 = {
  additionalProperties: false,
  properties: { feature: { type: "string" }, task: { type: "string" } },
  required: ["feature", "task"],
  type: "object",
};
function validate71(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate71.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.kind === undefined && (missing0 = "kind")) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        const _errs3 = errors;
        for (const key0 in data) {
          if (!(key0 === "kind")) {
            const err1 = {
              instancePath,
              schemaPath: "#/oneOf/0/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
            break;
          }
        }
        if (_errs3 === errors) {
          if (data.kind !== undefined) {
            let data0 = data.kind;
            if (typeof data0 !== "string") {
              const err2 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/0/properties/kind/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
            if ("Features" !== data0) {
              const err3 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/0/properties/kind/const",
                keyword: "const",
                params: { allowedValue: "Features" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
          }
        }
      }
    } else {
      const err4 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs6 = errors;
  if (errors === _errs6) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (
        (data.kind === undefined && (missing1 = "kind")) ||
        (data.feature === undefined && (missing1 = "feature"))
      ) {
        const err5 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing1 },
          message: "must have required property '" + missing1 + "'",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      } else {
        const _errs8 = errors;
        for (const key1 in data) {
          if (!(key1 === "feature" || key1 === "kind")) {
            const err6 = {
              instancePath,
              schemaPath: "#/oneOf/1/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
            break;
          }
        }
        if (_errs8 === errors) {
          if (data.feature !== undefined) {
            const _errs9 = errors;
            if (typeof data.feature !== "string") {
              const err7 = {
                instancePath: instancePath + "/feature",
                schemaPath: "#/oneOf/1/properties/feature/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err7];
              } else {
                vErrors.push(err7);
              }
              errors++;
            }
            var valid2 = _errs9 === errors;
          } else {
            var valid2 = true;
          }
          if (valid2) {
            if (data.kind !== undefined) {
              let data2 = data.kind;
              const _errs11 = errors;
              if (typeof data2 !== "string") {
                const err8 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/1/properties/kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err8];
                } else {
                  vErrors.push(err8);
                }
                errors++;
              }
              if ("Tasks" !== data2) {
                const err9 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/1/properties/kind/const",
                  keyword: "const",
                  params: { allowedValue: "Tasks" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err9];
                } else {
                  vErrors.push(err9);
                }
                errors++;
              }
              var valid2 = _errs11 === errors;
            } else {
              var valid2 = true;
            }
          }
        }
      }
    } else {
      const err10 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs13 = errors;
    if (errors === _errs13) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (
          (data.kind === undefined && (missing2 = "kind")) ||
          (data.query === undefined && (missing2 = "query"))
        ) {
          const err11 = {
            instancePath,
            schemaPath: "#/oneOf/2/required",
            keyword: "required",
            params: { missingProperty: missing2 },
            message: "must have required property '" + missing2 + "'",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        } else {
          const _errs15 = errors;
          for (const key2 in data) {
            if (!(key2 === "kind" || key2 === "query")) {
              const err12 = {
                instancePath,
                schemaPath: "#/oneOf/2/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key2 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
              break;
            }
          }
          if (_errs15 === errors) {
            if (data.kind !== undefined) {
              let data3 = data.kind;
              const _errs16 = errors;
              if (typeof data3 !== "string") {
                const err13 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/2/properties/kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err13];
                } else {
                  vErrors.push(err13);
                }
                errors++;
              }
              if ("Task" !== data3) {
                const err14 = {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/oneOf/2/properties/kind/const",
                  keyword: "const",
                  params: { allowedValue: "Task" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err14];
                } else {
                  vErrors.push(err14);
                }
                errors++;
              }
              var valid3 = _errs16 === errors;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.query !== undefined) {
                let data4 = data.query;
                const _errs18 = errors;
                const _errs19 = errors;
                if (errors === _errs19) {
                  if (
                    data4 &&
                    typeof data4 == "object" &&
                    !Array.isArray(data4)
                  ) {
                    let missing3;
                    if (
                      (data4.feature === undefined && (missing3 = "feature")) ||
                      (data4.task === undefined && (missing3 = "task"))
                    ) {
                      const err15 = {
                        instancePath: instancePath + "/query",
                        schemaPath: "#/$defs/TaskQuery/required",
                        keyword: "required",
                        params: { missingProperty: missing3 },
                        message:
                          "must have required property '" + missing3 + "'",
                      };
                      if (vErrors === null) {
                        vErrors = [err15];
                      } else {
                        vErrors.push(err15);
                      }
                      errors++;
                    } else {
                      const _errs21 = errors;
                      for (const key3 in data4) {
                        if (!(key3 === "feature" || key3 === "task")) {
                          const err16 = {
                            instancePath: instancePath + "/query",
                            schemaPath:
                              "#/$defs/TaskQuery/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key3 },
                            message: "must NOT have additional properties",
                          };
                          if (vErrors === null) {
                            vErrors = [err16];
                          } else {
                            vErrors.push(err16);
                          }
                          errors++;
                          break;
                        }
                      }
                      if (_errs21 === errors) {
                        if (data4.feature !== undefined) {
                          const _errs22 = errors;
                          if (typeof data4.feature !== "string") {
                            const err17 = {
                              instancePath: instancePath + "/query/feature",
                              schemaPath:
                                "#/$defs/TaskQuery/properties/feature/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            };
                            if (vErrors === null) {
                              vErrors = [err17];
                            } else {
                              vErrors.push(err17);
                            }
                            errors++;
                          }
                          var valid5 = _errs22 === errors;
                        } else {
                          var valid5 = true;
                        }
                        if (valid5) {
                          if (data4.task !== undefined) {
                            const _errs24 = errors;
                            if (typeof data4.task !== "string") {
                              const err18 = {
                                instancePath: instancePath + "/query/task",
                                schemaPath:
                                  "#/$defs/TaskQuery/properties/task/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err18];
                              } else {
                                vErrors.push(err18);
                              }
                              errors++;
                            }
                            var valid5 = _errs24 === errors;
                          } else {
                            var valid5 = true;
                          }
                        }
                      }
                    }
                  } else {
                    const err19 = {
                      instancePath: instancePath + "/query",
                      schemaPath: "#/$defs/TaskQuery/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    };
                    if (vErrors === null) {
                      vErrors = [err19];
                    } else {
                      vErrors.push(err19);
                    }
                    errors++;
                  }
                }
                var valid3 = _errs18 === errors;
              } else {
                var valid3 = true;
              }
            }
          }
        }
      } else {
        const err20 = {
          instancePath,
          schemaPath: "#/oneOf/2/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    var _valid0 = _errs13 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs26 = errors;
      if (errors === _errs26) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing4;
          if (
            (data.kind === undefined && (missing4 = "kind")) ||
            (data.query === undefined && (missing4 = "query"))
          ) {
            const err21 = {
              instancePath,
              schemaPath: "#/oneOf/3/required",
              keyword: "required",
              params: { missingProperty: missing4 },
              message: "must have required property '" + missing4 + "'",
            };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          } else {
            const _errs28 = errors;
            for (const key4 in data) {
              if (!(key4 === "kind" || key4 === "query")) {
                const err22 = {
                  instancePath,
                  schemaPath: "#/oneOf/3/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key4 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err22];
                } else {
                  vErrors.push(err22);
                }
                errors++;
                break;
              }
            }
            if (_errs28 === errors) {
              if (data.kind !== undefined) {
                let data7 = data.kind;
                const _errs29 = errors;
                if (typeof data7 !== "string") {
                  const err23 = {
                    instancePath: instancePath + "/kind",
                    schemaPath: "#/oneOf/3/properties/kind/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err23];
                  } else {
                    vErrors.push(err23);
                  }
                  errors++;
                }
                if ("History" !== data7) {
                  const err24 = {
                    instancePath: instancePath + "/kind",
                    schemaPath: "#/oneOf/3/properties/kind/const",
                    keyword: "const",
                    params: { allowedValue: "History" },
                    message: "must be equal to constant",
                  };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors++;
                }
                var valid6 = _errs29 === errors;
              } else {
                var valid6 = true;
              }
              if (valid6) {
                if (data.query !== undefined) {
                  let data8 = data.query;
                  const _errs31 = errors;
                  const _errs32 = errors;
                  if (errors === _errs32) {
                    if (
                      data8 &&
                      typeof data8 == "object" &&
                      !Array.isArray(data8)
                    ) {
                      let missing5;
                      if (
                        (data8.feature === undefined &&
                          (missing5 = "feature")) ||
                        (data8.task === undefined && (missing5 = "task"))
                      ) {
                        const err25 = {
                          instancePath: instancePath + "/query",
                          schemaPath: "#/$defs/TaskQuery/required",
                          keyword: "required",
                          params: { missingProperty: missing5 },
                          message:
                            "must have required property '" + missing5 + "'",
                        };
                        if (vErrors === null) {
                          vErrors = [err25];
                        } else {
                          vErrors.push(err25);
                        }
                        errors++;
                      } else {
                        const _errs34 = errors;
                        for (const key5 in data8) {
                          if (!(key5 === "feature" || key5 === "task")) {
                            const err26 = {
                              instancePath: instancePath + "/query",
                              schemaPath:
                                "#/$defs/TaskQuery/additionalProperties",
                              keyword: "additionalProperties",
                              params: { additionalProperty: key5 },
                              message: "must NOT have additional properties",
                            };
                            if (vErrors === null) {
                              vErrors = [err26];
                            } else {
                              vErrors.push(err26);
                            }
                            errors++;
                            break;
                          }
                        }
                        if (_errs34 === errors) {
                          if (data8.feature !== undefined) {
                            const _errs35 = errors;
                            if (typeof data8.feature !== "string") {
                              const err27 = {
                                instancePath: instancePath + "/query/feature",
                                schemaPath:
                                  "#/$defs/TaskQuery/properties/feature/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err27];
                              } else {
                                vErrors.push(err27);
                              }
                              errors++;
                            }
                            var valid8 = _errs35 === errors;
                          } else {
                            var valid8 = true;
                          }
                          if (valid8) {
                            if (data8.task !== undefined) {
                              const _errs37 = errors;
                              if (typeof data8.task !== "string") {
                                const err28 = {
                                  instancePath: instancePath + "/query/task",
                                  schemaPath:
                                    "#/$defs/TaskQuery/properties/task/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                };
                                if (vErrors === null) {
                                  vErrors = [err28];
                                } else {
                                  vErrors.push(err28);
                                }
                                errors++;
                              }
                              var valid8 = _errs37 === errors;
                            } else {
                              var valid8 = true;
                            }
                          }
                        }
                      }
                    } else {
                      const err29 = {
                        instancePath: instancePath + "/query",
                        schemaPath: "#/$defs/TaskQuery/type",
                        keyword: "type",
                        params: { type: "object" },
                        message: "must be object",
                      };
                      if (vErrors === null) {
                        vErrors = [err29];
                      } else {
                        vErrors.push(err29);
                      }
                      errors++;
                    }
                  }
                  var valid6 = _errs31 === errors;
                } else {
                  var valid6 = true;
                }
              }
            }
          }
        } else {
          const err30 = {
            instancePath,
            schemaPath: "#/oneOf/3/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
      }
      var _valid0 = _errs26 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
      }
    }
  }
  if (!valid0) {
    const err31 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err31];
    } else {
      vErrors.push(err31);
    }
    errors++;
    validate71.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate71.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate71.evaluated = { dynamicProps: true, dynamicItems: false };
function validate70(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate70.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.view === undefined && (missing0 = "view")) ||
        (data.page === undefined && (missing0 = "page"))
      ) {
        validate70.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.page !== undefined) {
          let data0 = data.page;
          const _errs1 = errors;
          if (!(typeof data0 == "number" && !(data0 % 1) && !isNaN(data0))) {
            validate70.errors = [
              {
                instancePath: instancePath + "/page",
                schemaPath: "#/properties/page/type",
                keyword: "type",
                params: { type: "integer" },
                message: "must be integer",
              },
            ];
            return false;
          }
          if (errors === _errs1) {
            if (typeof data0 == "number") {
              if (data0 < 0 || isNaN(data0)) {
                validate70.errors = [
                  {
                    instancePath: instancePath + "/page",
                    schemaPath: "#/properties/page/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  },
                ];
                return false;
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.view !== undefined) {
            const _errs3 = errors;
            if (
              !validate71(data.view, {
                instancePath: instancePath + "/view",
                parentData: data,
                parentDataProperty: "view",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate71.errors
                  : vErrors.concat(validate71.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
        }
      }
    } else {
      validate70.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate70.errors = vErrors;
  return errors === 0;
}
validate70.evaluated = {
  props: { page: true, view: true },
  dynamicProps: false,
  dynamicItems: false,
};
function validate21(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.selection === undefined && (missing0 = "selection")) ||
        (data.content === undefined && (missing0 = "content"))
      ) {
        validate21.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.content !== undefined) {
          const _errs1 = errors;
          if (
            !validate22(data.content, {
              instancePath: instancePath + "/content",
              parentData: data,
              parentDataProperty: "content",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate22.errors
                : vErrors.concat(validate22.errors);
            errors = vErrors.length;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.selection !== undefined) {
            const _errs2 = errors;
            if (
              !validate70(data.selection, {
                instancePath: instancePath + "/selection",
                parentData: data,
                parentDataProperty: "selection",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate70.errors
                  : vErrors.concat(validate70.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
        }
      }
    } else {
      validate21.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = {
  props: { content: true, selection: true },
  dynamicProps: false,
  dynamicItems: false,
};
function validate20(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  /*# sourceURL="dashboard-reply" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !validate21(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
      dynamicAnchors,
    })
  ) {
    vErrors =
      vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
    errors = vErrors.length;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = {
  props: { content: true, selection: true },
  dynamicProps: false,
  dynamicItems: false,
};
exports.failure = validate75;
const schema84 = {
  $id: "dashboard-failure",
  $ref: "#/$defs/DesktopFailure",
  $defs: {
    AgentId: {
      description: "An agent role scoped to its owning Cortex team.",
      oneOf: [
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/GizmoAgent" },
            team: { const: "Gizmo", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/DevelopmentAgent" },
            team: { const: "Development", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/AiAgent" },
            team: { const: "Ai", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/SecurityAgent" },
            team: { const: "Security", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/SreAgent" },
            team: { const: "Sre", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            role: { $ref: "#/$defs/DeliveryAgent" },
            team: { const: "Delivery", type: "string" },
          },
          required: ["team", "role"],
          type: "object",
        },
      ],
    },
    AiAgent: { enum: ["TechWriter"], type: "string" },
    Assignment: {
      additionalProperties: false,
      properties: {
        agent: { $ref: "#/$defs/AgentId" },
        attempt: { format: "int64", type: "integer" },
        expires_at: { format: "int64", type: "integer" },
        phase: { $ref: "#/$defs/Phase" },
      },
      required: ["agent", "attempt", "expires_at", "phase"],
      type: "object",
    },
    Check: {
      additionalProperties: false,
      properties: {
        command: { $ref: "#/$defs/Note" },
        evidence: { $ref: "#/$defs/Note" },
        outcome: { $ref: "#/$defs/CheckOutcome" },
      },
      required: ["command", "outcome", "evidence"],
      type: "object",
    },
    CheckOutcome: { enum: ["passed", "failed", "not_run"], type: "string" },
    Checkpoint: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "unrecorded", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            commit: { type: "string" },
            kind: { const: "git", type: "string" },
          },
          required: ["kind", "commit"],
          type: "object",
        },
      ],
    },
    DashboardView: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "Features", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            feature: { type: "string" },
            kind: { const: "Tasks", type: "string" },
          },
          required: ["kind", "feature"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "Task", type: "string" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "History", type: "string" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query"],
          type: "object",
        },
      ],
    },
    DeliveryAgent: { enum: ["IntegrationAgent", "PrAgent"], type: "string" },
    DesktopContent: {
      oneOf: [
        {
          properties: {
            kind: { const: "Features", type: "string" },
            value: { $ref: "#/$defs/Page" },
          },
          required: ["kind", "value"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Workflow", type: "string" },
            value: { $ref: "#/$defs/FeatureFlow" },
          },
          required: ["kind", "value"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Task", type: "string" },
            value: { $ref: "#/$defs/Task" },
          },
          required: ["kind", "value"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "History", type: "string" },
            value: { $ref: "#/$defs/Page3" },
          },
          required: ["kind", "value"],
          type: "object",
        },
      ],
    },
    DesktopFailure: {
      oneOf: [
        {
          properties: {
            kind: { const: "Ledger", type: "string" },
            message: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "message"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Runtime", type: "string" },
            message: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "message"],
          type: "object",
        },
        {
          properties: {
            kind: { const: "Native", type: "string" },
            message: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "message"],
          type: "object",
        },
      ],
    },
    DesktopRead: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "Initial", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "Features", type: "string" },
            page: { format: "uint32", minimum: 0, type: "integer" },
          },
          required: ["kind", "page"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            feature: { type: "string" },
            kind: { const: "Workflow", type: "string" },
            page: { format: "uint32", minimum: 0, type: "integer" },
          },
          required: ["kind", "feature", "page"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "Task", type: "string" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "History", type: "string" },
            page: { format: "uint32", minimum: 0, type: "integer" },
            query: { $ref: "#/$defs/TaskQuery" },
          },
          required: ["kind", "query", "page"],
          type: "object",
        },
      ],
    },
    DesktopReply: {
      properties: {
        content: { $ref: "#/$defs/DesktopContent" },
        selection: { $ref: "#/$defs/DesktopSelection" },
      },
      required: ["selection", "content"],
      type: "object",
    },
    DesktopSelection: {
      properties: {
        page: { format: "uint32", minimum: 0, type: "integer" },
        view: { $ref: "#/$defs/DashboardView" },
      },
      required: ["view", "page"],
      type: "object",
    },
    DevelopmentAgent: {
      enum: [
        "RustDev",
        "RustRefactoring",
        "RustVerifier",
        "TypescriptDev",
        "WebDesigner",
      ],
      type: "string",
    },
    Event: {
      additionalProperties: false,
      properties: {
        actor: { $ref: "#/$defs/AgentId" },
        kind: { $ref: "#/$defs/EventKind" },
        note: { $ref: "#/$defs/Note" },
        task: { $ref: "#/$defs/Task" },
        version: { format: "int64", type: "integer" },
      },
      required: ["version", "kind", "actor", "note", "task"],
      type: "object",
    },
    EventKind: {
      enum: [
        "created",
        "claimed",
        "heartbeat",
        "progress",
        "checkpoint",
        "ready",
        "integrated",
        "requeued",
        "cancelled",
      ],
      type: "string",
    },
    Feature: {
      additionalProperties: false,
      properties: {
        branch: { type: "string" },
        id: { type: "string" },
        objective: { $ref: "#/$defs/Note" },
        version: { format: "int64", type: "integer" },
        worktree: { type: "string" },
      },
      required: ["version", "id", "objective", "branch", "worktree"],
      type: "object",
    },
    FeatureFlow: {
      properties: {
        counts: { items: { $ref: "#/$defs/FlowCount" }, type: "array" },
        feature: { $ref: "#/$defs/Feature" },
        observed_at: { format: "int64", type: "integer" },
        tasks: { $ref: "#/$defs/Page2" },
      },
      required: ["feature", "counts", "tasks", "observed_at"],
      type: "object",
    },
    FlowCount: {
      properties: {
        count: { format: "uint64", minimum: 0, type: "integer" },
        state: { $ref: "#/$defs/FlowState" },
      },
      required: ["state", "count"],
      type: "object",
    },
    FlowState: {
      enum: [
        "queued",
        "working",
        "blocked",
        "ready",
        "integrated",
        "cancelled",
      ],
      type: "string",
    },
    GizmoAgent: { enum: ["GizmoPrime", "Gizmo"], type: "string" },
    Milestone: {
      properties: {
        actor: { $ref: "#/$defs/AgentId" },
        at: { format: "int64", type: "integer" },
        attempt: { format: "int64", type: "integer" },
        kind: { $ref: "#/$defs/EventKind" },
        note: { $ref: "#/$defs/Note" },
        revision: { format: "int64", type: "integer" },
      },
      required: ["kind", "actor", "at", "revision", "attempt", "note"],
      type: "object",
    },
    Note: { type: "string" },
    Page: {
      description:
        "A page of at most 100 records. Each operation releases its connection before returning.",
      properties: {
        end: { $ref: "#/$defs/PageEnd" },
        records: { items: { $ref: "#/$defs/Feature" }, type: "array" },
      },
      required: ["records", "end"],
      type: "object",
    },
    Page2: {
      description:
        "A page of at most 100 records. Each operation releases its connection before returning.",
      properties: {
        end: { $ref: "#/$defs/PageEnd" },
        records: { items: { $ref: "#/$defs/TaskFlow" }, type: "array" },
      },
      required: ["records", "end"],
      type: "object",
    },
    Page3: {
      description:
        "A page of at most 100 records. Each operation releases its connection before returning.",
      properties: {
        end: { $ref: "#/$defs/PageEnd" },
        records: { items: { $ref: "#/$defs/Event" }, type: "array" },
      },
      required: ["records", "end"],
      type: "object",
    },
    PageEnd: { enum: ["Complete", "More"], type: "string" },
    Phase: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "working", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "blocked", type: "string" },
            reason: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "reason"],
          type: "object",
        },
      ],
    },
    Progress: {
      additionalProperties: false,
      properties: {
        checks: { items: { $ref: "#/$defs/Check" }, type: "array" },
        extensions: {
          additionalProperties: true,
          default: {},
          description:
            "Task-specific data only. Coordination never interprets these keys.",
          type: "object",
        },
        findings: { items: { $ref: "#/$defs/Note" }, type: "array" },
        next_steps: { items: { $ref: "#/$defs/Note" }, type: "array" },
        summary: { $ref: "#/$defs/Note" },
      },
      required: ["summary", "findings", "next_steps", "checks"],
      type: "object",
    },
    RecordedActor: {
      oneOf: [
        {
          properties: { kind: { const: "unrecorded", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          properties: {
            agent: { $ref: "#/$defs/AgentId" },
            kind: { const: "recorded", type: "string" },
          },
          required: ["kind", "agent"],
          type: "object",
        },
      ],
    },
    RecordedCommit: {
      properties: {
        actor: { $ref: "#/$defs/AgentId" },
        at: { format: "int64", type: "integer" },
        commit: { type: "string" },
        revision: { format: "int64", type: "integer" },
      },
      required: ["commit", "actor", "at", "revision"],
      type: "object",
    },
    SecurityAgent: { enum: ["SecurityAgent"], type: "string" },
    SreAgent: {
      enum: ["CicdAgent", "DockerSpecialist", "KubernetesSpecialist"],
      type: "string",
    },
    Task: {
      additionalProperties: false,
      properties: {
        acceptance: { items: { $ref: "#/$defs/Note" }, type: "array" },
        attempt: { format: "int64", type: "integer" },
        checkpoint: { $ref: "#/$defs/Checkpoint" },
        created_at: { format: "int64", type: "integer" },
        dependencies: { items: { type: "string" }, type: "array" },
        feature: { type: "string" },
        id: { type: "string" },
        last_progress: { format: "int64", type: "integer" },
        last_update: { format: "int64", type: "integer" },
        objective: { $ref: "#/$defs/Note" },
        progress: { $ref: "#/$defs/Progress" },
        revision: { format: "int64", type: "integer" },
        state: { $ref: "#/$defs/TaskState" },
        version: { format: "int64", type: "integer" },
        workspace: { $ref: "#/$defs/Workspace" },
      },
      required: [
        "version",
        "id",
        "feature",
        "objective",
        "acceptance",
        "dependencies",
        "workspace",
        "revision",
        "attempt",
        "state",
        "created_at",
        "last_update",
        "last_progress",
        "checkpoint",
        "progress",
      ],
      type: "object",
    },
    TaskFlow: {
      properties: {
        checkpoints: {
          items: { $ref: "#/$defs/RecordedCommit" },
          type: "array",
        },
        created_by: { $ref: "#/$defs/RecordedActor" },
        history_end: { $ref: "#/$defs/PageEnd" },
        integrations: {
          items: { $ref: "#/$defs/RecordedCommit" },
          type: "array",
        },
        milestones: { items: { $ref: "#/$defs/Milestone" }, type: "array" },
        task: { $ref: "#/$defs/Task" },
        worker: { $ref: "#/$defs/RecordedActor" },
      },
      required: [
        "task",
        "created_by",
        "worker",
        "checkpoints",
        "integrations",
        "milestones",
        "history_end",
      ],
      type: "object",
    },
    TaskQuery: {
      additionalProperties: false,
      properties: { feature: { type: "string" }, task: { type: "string" } },
      required: ["feature", "task"],
      type: "object",
    },
    TaskState: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "queued", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            assignment: { $ref: "#/$defs/Assignment" },
            kind: { const: "active", type: "string" },
          },
          required: ["kind", "assignment"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            agent: { $ref: "#/$defs/AgentId" },
            attempt: { format: "int64", type: "integer" },
            kind: { const: "ready", type: "string" },
          },
          required: ["kind", "agent", "attempt"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            commit: { type: "string" },
            kind: { const: "integrated", type: "string" },
          },
          required: ["kind", "commit"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "cancelled", type: "string" },
            reason: { $ref: "#/$defs/Note" },
          },
          required: ["kind", "reason"],
          type: "object",
        },
      ],
    },
    Workspace: {
      oneOf: [
        {
          additionalProperties: false,
          properties: { kind: { const: "read_only", type: "string" } },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            branch: { type: "string" },
            kind: { const: "git", type: "string" },
            path: { type: "string" },
          },
          required: ["kind", "branch", "path"],
          type: "object",
        },
      ],
    },
  },
};
const schema85 = {
  oneOf: [
    {
      properties: {
        kind: { const: "Ledger", type: "string" },
        message: { $ref: "#/$defs/Note" },
      },
      required: ["kind", "message"],
      type: "object",
    },
    {
      properties: {
        kind: { const: "Runtime", type: "string" },
        message: { $ref: "#/$defs/Note" },
      },
      required: ["kind", "message"],
      type: "object",
    },
    {
      properties: {
        kind: { const: "Native", type: "string" },
        message: { $ref: "#/$defs/Note" },
      },
      required: ["kind", "message"],
      type: "object",
    },
  ],
};
function validate76(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate76.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.message === undefined && (missing0 = "message"))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        if (data.kind !== undefined) {
          let data0 = data.kind;
          const _errs3 = errors;
          if (typeof data0 !== "string") {
            const err1 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/0/properties/kind/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
          if ("Ledger" !== data0) {
            const err2 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/0/properties/kind/const",
              keyword: "const",
              params: { allowedValue: "Ledger" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
          var valid1 = _errs3 === errors;
        } else {
          var valid1 = true;
        }
        if (valid1) {
          if (data.message !== undefined) {
            const _errs5 = errors;
            if (typeof data.message !== "string") {
              const err3 = {
                instancePath: instancePath + "/message",
                schemaPath: "#/$defs/Note/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
            var valid1 = _errs5 === errors;
          } else {
            var valid1 = true;
          }
        }
      }
    } else {
      const err4 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = {};
    props0.kind = true;
    props0.message = true;
  }
  const _errs8 = errors;
  if (errors === _errs8) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (
        (data.kind === undefined && (missing1 = "kind")) ||
        (data.message === undefined && (missing1 = "message"))
      ) {
        const err5 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing1 },
          message: "must have required property '" + missing1 + "'",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      } else {
        if (data.kind !== undefined) {
          let data2 = data.kind;
          const _errs10 = errors;
          if (typeof data2 !== "string") {
            const err6 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/1/properties/kind/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
          if ("Runtime" !== data2) {
            const err7 = {
              instancePath: instancePath + "/kind",
              schemaPath: "#/oneOf/1/properties/kind/const",
              keyword: "const",
              params: { allowedValue: "Runtime" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
          var valid3 = _errs10 === errors;
        } else {
          var valid3 = true;
        }
        if (valid3) {
          if (data.message !== undefined) {
            const _errs12 = errors;
            if (typeof data.message !== "string") {
              const err8 = {
                instancePath: instancePath + "/message",
                schemaPath: "#/$defs/Note/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
            var valid3 = _errs12 === errors;
          } else {
            var valid3 = true;
          }
        }
      }
    } else {
      const err9 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
  }
  var _valid0 = _errs8 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = props0 || {};
        props0.kind = true;
        props0.message = true;
      }
    }
    const _errs15 = errors;
    if (errors === _errs15) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (
          (data.kind === undefined && (missing2 = "kind")) ||
          (data.message === undefined && (missing2 = "message"))
        ) {
          const err10 = {
            instancePath,
            schemaPath: "#/oneOf/2/required",
            keyword: "required",
            params: { missingProperty: missing2 },
            message: "must have required property '" + missing2 + "'",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        } else {
          if (data.kind !== undefined) {
            let data4 = data.kind;
            const _errs17 = errors;
            if (typeof data4 !== "string") {
              const err11 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/2/properties/kind/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
            if ("Native" !== data4) {
              const err12 = {
                instancePath: instancePath + "/kind",
                schemaPath: "#/oneOf/2/properties/kind/const",
                keyword: "const",
                params: { allowedValue: "Native" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
            var valid5 = _errs17 === errors;
          } else {
            var valid5 = true;
          }
          if (valid5) {
            if (data.message !== undefined) {
              const _errs19 = errors;
              if (typeof data.message !== "string") {
                const err13 = {
                  instancePath: instancePath + "/message",
                  schemaPath: "#/$defs/Note/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err13];
                } else {
                  vErrors.push(err13);
                }
                errors++;
              }
              var valid5 = _errs19 === errors;
            } else {
              var valid5 = true;
            }
          }
        }
      } else {
        const err14 = {
          instancePath,
          schemaPath: "#/oneOf/2/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    var _valid0 = _errs15 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = props0 || {};
          props0.kind = true;
          props0.message = true;
        }
      }
    }
  }
  if (!valid0) {
    const err15 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
    validate76.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate76.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate76.evaluated = { dynamicProps: true, dynamicItems: false };
function validate75(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  /*# sourceURL="dashboard-failure" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate75.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !validate76(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
      dynamicAnchors,
    })
  ) {
    vErrors =
      vErrors === null ? validate76.errors : vErrors.concat(validate76.errors);
    errors = vErrors.length;
  } else {
    var props0 = validate76.evaluated.props;
  }
  validate75.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate75.evaluated = { dynamicProps: true, dynamicItems: false };
