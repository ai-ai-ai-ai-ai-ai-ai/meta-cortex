import { invoke } from "@tauri-apps/api/core";
import { Effect, Match, Predicate, Schema } from "effect";
import {
  reply,
  catalog,
  failure,
  workflow,
} from "virtual:dashboard-validators";
import type {
  DesktopReply,
  DesktopCatalogReply,
  RepositorySelection,
  DesktopFailure,
  FeatureWorkflow,
  StoredFeatureSelection,
} from "./contracts";
export enum ReadFailureKind {
  InvalidReply = "InvalidReply",
  Transport = "Transport",
}
export enum NativeCommand {
  Catalog = "dashboard_read",
  Features = "dashboard_features",
  Workflow = "dashboard_workflow",
  Upgrade = "dashboard_upgrade",
}
export interface NativeTransportFailure {
  kind: ReadFailureKind.Transport;
  message: string;
  operation: NativeCommand;
  detail: string;
}
export interface InvalidNativeReply {
  kind: ReadFailureKind.InvalidReply;
  message: string;
  operation: NativeCommand;
  detail: string;
}
export type DashboardFailure =
  | DesktopFailure
  | NativeTransportFailure
  | InvalidNativeReply;
interface NativeFailureContext {
  operation: NativeCommand;
  transportMessage: string;
  invalidReplyMessage: string;
}
/** Only this native codec handles undecoded rejection payloads. */
class NativeFailureDecoder {
  constructor(private readonly context: NativeFailureContext) {}
  transport(cause: unknown): DashboardFailure {
    const decoded = decodeFailure(cause);
    switch (decoded._tag) {
      case "Success":
        return decoded.success;
      case "Failure":
        return {
          kind: ReadFailureKind.Transport,
          message: this.context.transportMessage,
          operation: this.context.operation,
          detail: this.rejectionDetail(cause),
        };
    }
  }
  private rejectionDetail(cause: unknown): string {
    return Match.value(cause).pipe(
      Match.when(
        Predicate.isError,
        (error) => `${error.name}: ${error.message}`,
      ),
      Match.when(Predicate.isString, (message) => message),
      Match.orElse(() => "The native host returned an unrecognized failure."),
    );
  }
  invalid(error: Schema.SchemaError): InvalidNativeReply {
    return {
      kind: ReadFailureKind.InvalidReply,
      message: this.context.invalidReplyMessage,
      operation: this.context.operation,
      detail: error.message,
    };
  }
}
/** Adapt Rust-generated validation without duplicating its schema or DTOs. */
const decodeFailure = Schema.decodeUnknownResult(Schema.declare(failure));
const decodeCatalog = Schema.decodeUnknownEffect(Schema.declare(catalog));
const decodeFeatures = Schema.decodeUnknownEffect(Schema.declare(reply));
const decodeWorkflow = Schema.decodeUnknownEffect(Schema.declare(workflow));
interface NativeReadAttempt {
  try: () => Promise<unknown>;
  catch: (cause: unknown) => DashboardFailure;
}
export type RepositoryReadArguments = {
  repository: RepositorySelection;
};
export type WorkflowInvocation = {
  selection: StoredFeatureSelection;
};
type WorkflowOperation = NativeCommand.Workflow | NativeCommand.Upgrade;
interface WorkflowRequest {
  command: WorkflowOperation;
  selection: StoredFeatureSelection;
}
export class DashboardApi {
  workflow(
    selection: StoredFeatureSelection,
  ): Effect.Effect<FeatureWorkflow, DashboardFailure> {
    const request: WorkflowRequest = {
      command: NativeCommand.Workflow,
      selection,
    };
    return this.loadWorkflow(request);
  }
  upgrade(
    selection: StoredFeatureSelection,
  ): Effect.Effect<FeatureWorkflow, DashboardFailure> {
    const request: WorkflowRequest = {
      command: NativeCommand.Upgrade,
      selection,
    };
    return this.loadWorkflow(request);
  }
  private loadWorkflow(
    request: WorkflowRequest,
  ): Effect.Effect<FeatureWorkflow, DashboardFailure> {
    const args: WorkflowInvocation = { selection: request.selection };
    const context: NativeFailureContext = {
      operation: request.command,
      transportMessage:
        "The workflow operation could not be completed. Retry the selected action.",
      invalidReplyMessage:
        "The native workflow reply is invalid. Refresh to retry.",
    };
    const errors = new NativeFailureDecoder(context);
    const attempt: NativeReadAttempt = {
      try: () => invoke<unknown>(request.command, args),
      catch: (cause) => errors.transport(cause),
    };
    return Effect.tryPromise(attempt).pipe(
      Effect.flatMap((value) =>
        decodeWorkflow(value).pipe(
          Effect.mapError((error) => errors.invalid(error)),
        ),
      ),
    );
  }
  read(): Effect.Effect<DesktopCatalogReply, DashboardFailure> {
    const context: NativeFailureContext = {
      operation: NativeCommand.Catalog,
      transportMessage: "The ledger could not be read. Refresh to retry.",
      invalidReplyMessage: "The native reply is invalid. Refresh to retry.",
    };
    const errors = new NativeFailureDecoder(context);
    const attempt: NativeReadAttempt = {
      try: () => invoke<unknown>(NativeCommand.Catalog),
      catch: (cause) => errors.transport(cause),
    };
    return Effect.tryPromise(attempt).pipe(
      Effect.flatMap((value) =>
        decodeCatalog(value).pipe(
          Effect.mapError((error) => errors.invalid(error)),
        ),
      ),
    );
  }
  features(
    repository: RepositorySelection,
  ): Effect.Effect<DesktopReply, DashboardFailure> {
    const arguments_: RepositoryReadArguments = { repository };
    const context: NativeFailureContext = {
      operation: NativeCommand.Features,
      transportMessage: "The ledger could not be read. Refresh to retry.",
      invalidReplyMessage: "The native reply is invalid. Refresh to retry.",
    };
    const errors = new NativeFailureDecoder(context);
    const attempt: NativeReadAttempt = {
      try: () => invoke<unknown>(NativeCommand.Features, arguments_),
      catch: (cause) => errors.transport(cause),
    };
    return Effect.tryPromise(attempt).pipe(
      Effect.flatMap((value) =>
        decodeFeatures(value).pipe(
          Effect.mapError((error) => errors.invalid(error)),
        ),
      ),
    );
  }
}
