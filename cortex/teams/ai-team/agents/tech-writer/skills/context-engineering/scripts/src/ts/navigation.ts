import { Effect } from "effect";
import { globby, type Options } from "globby";
import type { Root, Link } from "mdast";
import { toString } from "mdast-util-to-string";
import { dirname, basename, resolve, relative } from "node:path";
import { selectAll } from "unist-util-select";
import type { Transformer } from "unified";
import type { VFile } from "vfile";

interface PracticeIndex {
  readonly tree: Root;
  readonly file: VFile;
}

class Navigation {
  constructor(private readonly document: PracticeIndex) {}

  readonly audit = Effect.fnUntraced(function* (this: Navigation) {
    const { tree, file } = this.document;
    switch (basename(file.path)) {
      case "index.md":
        break;
      default:
        return;
    }
    const root = dirname(file.path);
    const options: Options = { cwd: root, absolute: true };
    const practices = yield* Effect.tryPromise(() =>
      globby("practices/**/*.md", options),
    );
    switch (practices.length) {
      case 0:
        return;
      default:
        break;
    }
    const paragraphs = selectAll("listItem > paragraph", tree).filter((node) =>
      /^(File|Source):/.test(toString(node)),
    );
    const owners = paragraphs
      .flatMap((paragraph) => selectAll("link", paragraph))
      .filter((node): node is Link => node.type === "link");
    const targets = owners.map((link) =>
      resolve(root, decodeURIComponent(link.url.split("#")[0] || "")),
    );
    for (const practice of practices) {
      switch (targets.filter((target) => target === practice).length) {
        case 0:
          file.message(
            `Missing owning File entry for ${relative(root, practice)}.`,
            "cortex:missing-owner-entry",
          );
          break;
        case 1:
          break;
        default:
          file.message(
            `Duplicate owning File entry for ${relative(root, practice)}.`,
            "cortex:duplicate-owner-entry",
          );
      }
    }
    const rules = selectAll("strong > link", tree).filter(
      (node): node is Link => node.type === "link",
    );
    const seen = new Set<string>();
    for (const rule of rules) {
      const name = toString(rule);
      switch (/^[a-z_]+:[a-z_]+$/.test(name)) {
        case false:
          continue;
        case true:
          break;
      }
      switch (seen.has(name)) {
        case true:
          file.message(
            `Duplicate rule name: ${name}.`,
            rule,
            "cortex:duplicate-rule",
          );
          break;
        case false:
          seen.add(name);
      }
      switch (rule.url.includes("#")) {
        case false:
          file.message(
            `Link ${name} to its exact source heading.`,
            rule,
            "cortex:missing-rule-anchor",
          );
          break;
        case true:
          break;
      }
    }
  });

  static plugin(): Transformer<Root> {
    // unified's Transformer contract supplies the tree and file separately.
    // eslint-disable-next-line max-params
    return (tree, file) => {
      const document: PracticeIndex = { tree, file };
      return Effect.runPromise(new Navigation(document).audit());
    };
  }
}
export default Navigation.plugin;
