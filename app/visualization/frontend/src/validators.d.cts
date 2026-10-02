import type { DesktopReply, DesktopFailure } from "./contracts";
/** AJV standalone validators generated from Rust's canonical contract schema. */
export declare function reply(value: unknown): value is DesktopReply;
export declare function failure(value: unknown): value is DesktopFailure;
