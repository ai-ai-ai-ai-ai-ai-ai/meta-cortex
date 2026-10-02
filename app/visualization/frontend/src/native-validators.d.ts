/** Static AJV exports supplied by the Vite plugin from Rust's contract schema. */
declare module "virtual:dashboard-validators" {
  export function reply(
    value: unknown,
  ): value is import("./contracts").DesktopReply;
  export function failure(
    value: unknown,
  ): value is import("./contracts").DesktopFailure;
}
