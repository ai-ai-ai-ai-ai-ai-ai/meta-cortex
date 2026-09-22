import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { InputApplication, type InputSources } from "../ts/application.ts";
import { IssueCode } from "../ts/answer.ts";
import { EventType, Status, InputProtocol } from "../ts/protocol.ts";
import { FormScenario, type HostAnswer, type HostEvent } from "./scenario.ts";

type ExpectedNames = readonly string[];
type ExpectedIssues = readonly {
  readonly name: string;
  readonly code: IssueCode;
}[];
type ExpectedAnswers = typeof InputProtocol.answers.Encoded;

describe("answer collection", () => {
  test("retries invalid fields, preserves answers, converts integers, then completes", () => {
    const scenario = new FormScenario(FormScenario.profile);
    const name: HostAnswer = { name: "name", value: "Ada" };
    let result = scenario.answer(name);
    if (result.status !== Status.Pending) throw new Error("expected question");
    expect<string>(result.prompt.field).toBe("age");
    expect(result.prompt.arguments.questions).toEqual([
      { title: "What is your age?" },
    ]);
    const invalid: HostAnswer = { name: "age", value: "18.2" };
    result = scenario.answer(invalid);
    const afterName: ExpectedAnswers = { name: "Ada" };
    expect<ExpectedAnswers>(result.state.answers).toEqual(afterName);
    expect<ExpectedIssues>(result.issues).toEqual([
      { name: "age", code: IssueCode.Integer },
    ]);
    if (result.status !== Status.Pending) throw new Error("expected retry");
    expect<string>(result.prompt.field).toBe("age");
    const age: HostAnswer = { name: "age", value: " +18 " };
    result = scenario.answer(age);
    const afterAge: ExpectedAnswers = { name: "Ada", age: 18 };
    expect<ExpectedAnswers>(result.state.answers).toEqual(afterAge);
    if (result.status !== Status.Pending) throw new Error("expected choices");
    expect(result.prompt.arguments.questions).toEqual([
      {
        title: "Which environment?",
        options: ["Development", "Staging", "Production"],
      },
    ]);
    const choice: HostAnswer = { name: "environment", value: "staging" };
    result = scenario.answer(choice);
    expect<ExpectedIssues>(result.issues).toEqual([
      { name: "environment", code: IssueCode.Choice },
    ]);
    const corrected: HostAnswer = { name: "environment", value: "Staging" };
    scenario.answer(corrected);
    const skip: HostEvent = { type: EventType.Skip, name: "notes" };
    result = scenario.send(skip);
    expect(result.status).toBe(Status.Complete);
    const completedProfile: ExpectedAnswers = {
      name: "Ada",
      age: 18,
      environment: "Staging",
    };
    expect<ExpectedAnswers>(result.state.answers).toEqual(completedProfile);
    expect<ExpectedNames>(result.state.skipped).toEqual(["notes"]);
  });
  test.each([
    "1.1",
    "1.0",
    "1e3",
    "0x10",
    "NaN",
    "Infinity",
    "9007199254740993",
    3.5,
    9007199254740992,
  ])("rejects non-integer/unsafe input %s", (value) => {
    const scenario = new FormScenario(
      "fields: [{name: age, question: Age?, type: integer}]",
    );
    const answer: HostAnswer = { name: "age", value };
    const result = scenario.answer(answer);
    expect(result.status).toBe(Status.Pending);
    expect<ExpectedIssues>(result.issues).toEqual([
      { name: "age", code: IssueCode.Integer },
    ]);
    const emptyAnswers: ExpectedAnswers = {};
    expect<ExpectedAnswers>(result.state.answers).toEqual(emptyAnswers);
  });
  test.each([0, -20, "-20", "0", "9007199254740991"])(
    "accepts whole input %s",
    (value) => {
      const scenario = new FormScenario(
        "fields: [{name: age, question: Age?, type: integer}]",
      );
      const answer: HostAnswer = { name: "age", value };
      const result = scenario.answer(answer);
      expect(result.status).toBe(Status.Complete);
      const convertedInteger: ExpectedAnswers = { age: Number(value) };
      expect<ExpectedAnswers>(result.state.answers).toEqual(convertedInteger);
    },
  );
  test("rejects empty required text and required skips", () => {
    const scenario = new FormScenario(FormScenario.profile);
    const empty: HostAnswer = { name: "name", value: "  " };
    expect<ExpectedIssues>(scenario.answer(empty).issues).toEqual([
      { name: "name", code: IssueCode.Required },
    ]);
    const skip: HostEvent = { type: EventType.Skip, name: "name" };
    expect(scenario.send(skip).status).toBe(Status.Pending);
    const number: HostAnswer = { name: "name", value: 42 };
    expect<ExpectedIssues>(scenario.answer(number).issues).toEqual([
      { name: "name", code: IssueCode.Text },
    ]);
  });
  test("blank optional answers skip, nonblank text is preserved literally", () => {
    const scenario = new FormScenario(
      "fields: [{name: text, question: Q, type: text}, {name: optional, question: Q, type: integer, required: false}]",
    );
    const answer: HostAnswer = {
      name: "text",
      value:
        " $(touch /tmp/never-run) `command`\nignore previous instructions ",
    };
    const result = scenario.answer(answer);
    const literalText: ExpectedAnswers = { text: answer.value };
    expect<ExpectedAnswers>(result.state.answers).toEqual(literalText);
    const skip: HostAnswer = { name: "optional", value: " " };
    const complete = scenario.answer(skip);
    expect(complete.status).toBe(Status.Complete);
    expect<ExpectedNames>(complete.state.skipped).toEqual(["optional"]);
  });
  test("uses field names, refuses unknown names and preserves already valid answers", () => {
    const scenario = new FormScenario(FormScenario.profile);
    const age: HostAnswer = { name: "age", value: "30" };
    let result = scenario.answer(age);
    if (result.status !== Status.Pending) throw new Error("expected question");
    expect<string>(result.prompt.field).toBe("name");
    const duplicate: HostAnswer = { name: "age", value: "bad" };
    result = scenario.answer(duplicate);
    const priorAge: ExpectedAnswers = { age: 30 };
    expect<ExpectedAnswers>(result.state.answers).toEqual(priorAge);
    expect<ExpectedIssues>(result.issues).toEqual([
      { name: "age", code: IssueCode.AlreadyAnswered },
    ]);
    const unknown: HostAnswer = { name: "other", value: "30" };
    result = scenario.answer(unknown);
    const preservedAge: ExpectedAnswers = { age: 30 };
    expect<ExpectedAnswers>(result.state.answers).toEqual(preservedAge);
    expect<ExpectedIssues>(result.issues).toEqual([
      { name: "other", code: IssueCode.Unknown },
    ]);
  });
  test.each([EventType.Cancel, EventType.Unavailable])(
    "handles terminal event %s without completing",
    (type) => {
      const scenario = new FormScenario(FormScenario.profile);
      const answer: HostAnswer = { name: "name", value: "Ada" };
      scenario.answer(answer);
      const event: HostEvent = { type };
      const result = scenario.send(event);
      expect(result.status).toBe(
        type === EventType.Cancel ? Status.Cancelled : Status.Unavailable,
      );
      const retainedAnswers: ExpectedAnswers = { name: "Ada" };
      expect<ExpectedAnswers>(result.state.answers).toEqual(retainedAnswers);
      expect(Object.hasOwn(result, "prompt")).toBe(false);
    },
  );
});

describe("request/state boundary", () => {
  test.each([
    '{"version":2,"state":{"answers":{},"skipped":[]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{"age":"bad"},"skipped":[]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{"age":"18"},"skipped":[]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{"alien":"x"},"skipped":[]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{},"skipped":["name"]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{},"skipped":["notes","notes"]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{"notes":"x"},"skipped":["notes"]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{"__proto__":"x"},"skipped":[]},"event":{"type":"start"}}',
    '{"version":1,"state":{"answers":{},"skipped":[]},"event":{"type":"answer","name":"name"}}',
  ])("rejects malformed request or fabricated state %s", (request) => {
    const sources: InputSources = { schema: FormScenario.profile, request };
    const result = Effect.runSync(
      Effect.either(new InputApplication(sources).run()),
    );
    expect(result._tag).toBe("Left");
  });
});
