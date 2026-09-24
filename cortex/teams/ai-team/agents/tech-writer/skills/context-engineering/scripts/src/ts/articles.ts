// Article checks adapted from Nook. See LICENSE.nook.
import type { Root, RootContent, Heading } from "mdast";
import { toString } from "mdast-util-to-string";
import { selectAll } from "unist-util-select";
import type { Transformer } from "unified";
import type { VFile } from "vfile";

interface DocumentArticle {
  readonly file: VFile;
  readonly heading: Heading;
  readonly children: RootContent[];
}

class Article {
  constructor(private readonly document: DocumentArticle) {}

  audit(): void {
    const { file, heading, children } = this.document;
    const content = children.filter((node) =>
      ["paragraph", "list", "code", "blockquote"].includes(node.type),
    );
    switch (content.length) {
      case 0:
        file.message(
          "Give this section substantive content.",
          heading,
          "cortex:empty-article",
        );
        return;
      default:
        break;
    }
    const label = toString(heading).match(
      /\b(procedures?|runbooks?|steps|ordered deliver(?:y|ies)|delivery sequences?)\b/i,
    );
    switch (label) {
      case null:
        break;
      default:
        this.requireSteps();
    }
    let consecutive = 0;
    for (const node of children) {
      switch (node.type) {
        case "heading":
          return;
        case "definition":
        case "yaml":
          continue;
        case "paragraph":
          consecutive += 1;
          break;
        case "link":
        case "blockquote":
        case "break":
        case "code":
        case "delete":
        case "emphasis":
        case "footnoteDefinition":
        case "footnoteReference":
        case "html":
        case "image":
        case "imageReference":
        case "inlineCode":
        case "linkReference":
        case "list":
        case "listItem":
        case "strong":
        case "table":
        case "tableCell":
        case "tableRow":
        case "text":
        case "thematicBreak":
          consecutive = 0;
      }
      switch (consecutive) {
        case 4:
          file.message(
            "Break up more than three consecutive paragraphs.",
            node,
            "cortex:dense-article",
          );
          break;
        default:
          break;
      }
    }
  }

  private requireSteps(): void {
    const actions = this.document.children.filter(
      (node) => node.type === "list" && node.ordered === true,
    );
    switch (actions.length) {
      case 0:
        this.document.file.message(
          "Use numbered actions in a procedure section.",
          this.document.heading,
          "cortex:unordered-procedure",
        );
        break;
      default:
        break;
    }
  }

  static plugin(): Transformer<Root> {
    // unified's Transformer contract supplies the tree and file separately.
    // eslint-disable-next-line max-params
    return (tree, file) => {
      for (const node of selectAll("table", tree)) {
        file.message(
          "Use a structured list instead of a Markdown table.",
          node,
          "cortex:markdown-table",
        );
      }
      const headings = tree.children.filter(
        (node): node is Heading =>
          node.type === "heading" && [2, 3].includes(node.depth),
      );
      for (const heading of headings) {
        const following = tree.children.slice(
          tree.children.indexOf(heading) + 1,
        );
        const end = following.findIndex(
          (node) => node.type === "heading" && node.depth <= heading.depth,
        );
        let children = following;
        switch (end) {
          case -1:
            break;
          default:
            children = following.slice(0, end);
        }
        const document: DocumentArticle = { file, heading, children };
        new Article(document).audit();
      }
    };
  }
}
export default Article.plugin;
