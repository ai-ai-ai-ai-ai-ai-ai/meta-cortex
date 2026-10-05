// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Match } from "effect";
import { GuideSource } from "./guide-source";
vi.mock("node:fs", async (importOriginal) => {
  const filesystem = await importOriginal<typeof import("node:fs")>();
  return { ...filesystem, readFileSync: vi.fn(filesystem.readFileSync) };
});
enum CanonicalEnding {
  LF = "LF",
  CRLF = "CRLF",
}
enum GeneratedKind {
  Present = "Present",
  Missing = "Missing",
}
type GeneratedModule =
  | { readonly kind: GeneratedKind.Present; readonly source: string }
  | { readonly kind: GeneratedKind.Missing };
class CanonicalNewlines {
  private readonly source = new GuideSource();
  private readonly files = new Map<string, string>();
  async load(ending: CanonicalEnding): Promise<GeneratedModule> {
    const filesystem =
      await vi.importActual<typeof import("node:fs")>("node:fs");
    vi.mocked(readFileSync).mockImplementation((path) => {
      const text = filesystem.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
      switch (ending) {
        case CanonicalEnding.LF:
          this.files.set(String(path), text);
          return text;
        case CanonicalEnding.CRLF: {
          const windows = text.replace(/\n/g, "\r\n");
          this.files.set(String(path), windows);
          return windows;
        }
      }
    });
    return Match.value(this.source.load("\0virtual:agent-guide")).pipe(
      Match.when(
        Match.string,
        (source): GeneratedModule => ({ kind: GeneratedKind.Present, source }),
      ),
      Match.orElse((): GeneratedModule => ({ kind: GeneratedKind.Missing })),
    );
  }
  present(module: GeneratedModule): string {
    switch (module.kind) {
      case GeneratedKind.Present:
        return module.source;
      case GeneratedKind.Missing:
        return expect.fail("Canonical guide module was not generated");
    }
  }
  inputs(): ReadonlyMap<string, string> {
    return this.files;
  }
}
afterEach(() => vi.restoreAllMocks());
it("builds the same complete canonical guide from LF and CRLF role, catalog and protocol sources", async () => {
  const fixture = new CanonicalNewlines();
  const lf = await fixture.load(CanonicalEnding.LF);
  const crlf = await fixture.load(CanonicalEnding.CRLF);
  expect(lf.kind).toBe(GeneratedKind.Present);
  expect(crlf.kind).toBe(GeneratedKind.Present);
  const lfModule = fixture.present(lf);
  const crlfModule = fixture.present(crlf);
  expect(crlfModule).toBe(lfModule);
  expect(fixture.inputs().size).toBe(25);
  for (const text of fixture.inputs().values()) expect(text).toContain("\r\n");
  expect(lfModule).toContain("Rust Developer");
  expect(lfModule).toContain("coordination-state-machine.md");
});
