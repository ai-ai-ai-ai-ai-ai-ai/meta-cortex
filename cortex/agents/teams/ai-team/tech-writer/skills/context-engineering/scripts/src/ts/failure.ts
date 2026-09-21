import { Data } from "effect";
export enum FailureCode {
  Usage = "usage",
  Yaml = "invalid-yaml",
  Request = "invalid-request",
  Response = "response-capacity",
}
export class SkillFailure extends Data.TaggedError("SkillFailure")<{
  readonly code: FailureCode;
}> {
  static from(code: FailureCode): SkillFailure {
    const details: SkillFailureDetails = { code };
    return new SkillFailure(details);
  }
}
type SkillFailureDetails = { readonly code: FailureCode };
