import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

class NormativeCases {
  static readonly imports = `import { type Job, type Prompt, type Required, type Prohibited, PromptStatement } from "@meta-cortex/lace";`;
  static receipt(prompt: string): string {
    return `${NormativeCases.imports} const receipt: Job = { stages: { read: { Statement: { prompt: ${prompt} } } } }; export default receipt;`;
  }
  static readonly valid = [
    `{ Required: { items: { read: "Read." } } }`,
    `{ Prohibited: { items: { skip: "Do not skip." } } }`,
    `{ Required: { items: { prohibited: { Prohibited: { items: { skip: "Do not skip." } } }, preferred: { BulletList: { label: "Preferred", items: { read: "Read." } } } } } }`,
    `{ BulletList: { items: { requirements: { Required: { items: { restrictions: { Prohibited: { items: { read: "Read." } } } } } } } } }`,
    `{ BulletList: { label: "Required context", items: { read: "Read." } } }`,
    `{ Required: { items: { Required: { Required: { items: { Prohibited: { Prohibited: { items: { items: "Read." } } } } } } } } }`,
  ];
  static readonly malformed = [
    `{ Required: { items: {} } }`,
    `{ Prohibited: { items: [] } }`,
    `{ Required: { items: { read: " " } } }`,
    `{ Required: { label: "Rules", items: { read: "Read." } } }`,
    `{ Prohibited: { kind: "prohibited", items: { read: "Read." } } }`,
    `{ Required: { items: Promise.name } }`,
    `{ Prohibited: { items: { read: Promise.name } } }`,
    `{ Required: { items: { [Promise.name]: "Read." } } }`,
    `{ Required: { items: { ...Promise } } }`,
    `{ Required: { items: { read() {} } } }`,
    `{ Required: { items: { read: PromptStatement.content("Read.") } } }`,
    `{ Required: PromptStatement.content("Read.") }`,
    `{ Required: { items: { read: "Read." } }, Prohibited: { items: { skip: "Skip." } } }`,
    `{ Required: { items: { read: { PromptStatement: { content: "Read." } } } } }`,
  ];
}
for (const prompt of NormativeCases.valid) {
  test(`typed normative root or nested group compiles and passes grammar: ${prompt}`, () => {
    const source = NormativeCases.receipt(prompt);
    expect(new ReceiptCompilation(source).messages()).toEqual([]);
    expect(new ReceiptSyntax(source).messages()).toEqual([]);
  });
}
for (const prompt of NormativeCases.malformed) {
  test(`grammar rejects malformed normative prompt: ${prompt}`, () => {
    expect(
      new ReceiptSyntax(NormativeCases.receipt(prompt)).messages().length,
    ).toBeGreaterThan(0);
  });
}
for (const label of [
  "Required",
  "Required actions",
  "Prohibited",
  "Prohibited actions",
]) {
  for (const literal of [JSON.stringify(label), `\`${label}\``]) {
    test(`generic normative label requires typed category: ${literal}`, () => {
      const prompt = `{ BulletList: { label: ${literal}, items: { read: "Read." } } }`;
      expect(
        new ReceiptCompilation(NormativeCases.receipt(prompt)).messages(),
      ).toEqual([]);
      expect(
        new ReceiptSyntax(NormativeCases.receipt(prompt)).messages().join("\n"),
      ).toContain("typed prompts");
    });
  }
}
for (const mutation of [
  `required.items = {};`,
  `required.items.read = "Changed.";`,
  `prohibited.items = {};`,
  `prohibited.items.skip = "Changed.";`,
]) {
  test(`normative payload and item fields are readonly: ${mutation}`, () => {
    const source = `${NormativeCases.imports} const required: Required = {items:{read:"Read."}}; const prohibited: Prohibited = {items:{skip:"Skip."}}; ${mutation}`;
    expect(new ReceiptCompilation(source).messages().join("\n")).toMatch(
      /read-only|only permits reading/,
    );
  });
}
for (const scenario of [
  {
    branch: "Required",
    other: "Prohibited",
    payload: `{ items: { read: "Read." } }`,
  },
  {
    branch: "Prohibited",
    other: "Required",
    payload: `{ items: { read: "Read." } }`,
  },
  {
    branch: "BulletList",
    other: "Required",
    payload: `{ items: { read: "Read." } }`,
  },
  {
    branch: "PromptStatement",
    other: "Required",
    payload: `{ content: "Read." }`,
  },
]) {
  test(`structural hybrid excludes ${scenario.branch}`, () => {
    const source = `${NormativeCases.imports} const hybrid = {${scenario.branch}: ${scenario.payload}, ${scenario.other}: {items:{read:"Read."}}}; const prompt: Prompt = hybrid;`;
    expect(new ReceiptCompilation(source).messages().length).toBeGreaterThan(0);
  });
}

for (const name of ["Required", "Prohibited"]) {
  test(`normative wrapper names remain arbitrary nested stage and item keys: ${name}`, () => {
    const source = `${NormativeCases.imports} const receipt: Job = { stages: { ${name}: { stages: { ${name}: { Statement: { prompt: { ${name}: { items: { ${name}: { ${name}: { items: { ${name}: "Read." } } } } } } } } } } } }; export default receipt;`;
    expect(new ReceiptCompilation(source).messages()).toEqual([]);
    expect(new ReceiptSyntax(source).messages()).toEqual([]);
  });
  test(`normative prompt cannot be a direct stage: ${name}`, () => {
    const source = `${NormativeCases.imports} const receipt: Job = { stages: { read: { ${name}: { items: { read: "Read." } } } } }; export default receipt;`;
    expect(new ReceiptCompilation(source).messages().length).toBeGreaterThan(0);
    expect(new ReceiptSyntax(source).messages().length).toBeGreaterThan(0);
  });
}
