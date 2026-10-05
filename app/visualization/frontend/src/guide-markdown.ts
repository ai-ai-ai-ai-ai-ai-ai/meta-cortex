import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Effect, Match } from "effect";
import type { GuideDocument } from "./contracts";

export class GuideMarkdown {
  private readonly parser = new MarkdownIt({ html: false }).use(anchor);
  private fragment = "";
  constructor(
    readonly documents: ReadonlyArray<GuideDocument>,
    readonly select: (path: string) => void,
    readonly notice: (message: string) => void,
  ) {}

  mount = (node: HTMLElement, source: GuideDocument) => {
    let current = source;
    this.render(node, current);
    const click = (event: MouseEvent): void => {
      Match.value(event.target).pipe(
        Match.when(Match.instanceOf(Element), (target) => {
          const link = target.closest("a");
          Match.value(link).pipe(
            Match.when(Match.instanceOf(HTMLAnchorElement), (element) => {
              event.preventDefault();
              this.follow(element.getAttribute("href") ?? "", current, node);
            }),
            Match.orElse(() => {}),
          );
        }),
        Match.orElse(() => {}),
      );
    };
    node.addEventListener("click", click);
    return {
      update: (next: GuideDocument) => {
        current = next;
        this.render(node, current);
        this.focus(node);
      },
      destroy: () => node.removeEventListener("click", click),
    };
  };

  private render(node: HTMLElement, source: GuideDocument): void {
    // Raw HTML is disabled; markdown-it escapes content and rejects unsafe URLs.
    node.innerHTML = this.parser.render(source.markdown);
    for (const heading of node.querySelectorAll<HTMLElement>("[id]")) {
      heading.id = `guide-doc-${heading.id}`;
    }
  }

  private follow(href: string, source: GuideDocument, node: HTMLElement): void {
    this.notice("");
    const base = new URL(source.path, "https://guide.invalid/");
    Match.value(URL.parse(href, base)).pipe(
      Match.when(Match.defined, (url) => this.route(url, node)),
      Match.orElse(() => this.notice("This documentation link is invalid.")),
    );
  }

  private route(url: URL, node: HTMLElement): void {
    switch (url.origin) {
      case "https://guide.invalid": {
        const path = url.pathname.slice(1);
        this.fragment = url.hash.slice(1);
        Match.value(this.documents.find((doc) => doc.path === path)).pipe(
          Match.when(Match.defined, (doc) => {
            this.select(doc.path);
            this.focus(node);
          }),
          Match.orElse(() =>
            this.notice(`Not included in this guide: ${path}`),
          ),
        );
        return;
      }
      default:
        this.external(url);
    }
  }

  private external(url: URL): void {
    switch (url.protocol) {
      case "https:":
      case "http:":
        Effect.runFork(
          Effect.tryPromise(() => openUrl(url.href)).pipe(
            Effect.match({
              onFailure: () => this.notice(`Could not open ${url.href}`),
              onSuccess: () => {},
            }),
          ),
        );
        return;
      default:
        this.notice("This link type is not supported in the guide.");
    }
  }

  private focus(node: HTMLElement): void {
    const heading = Array.from(node.querySelectorAll<HTMLElement>("[id]")).find(
      (element) => element.id === `guide-doc-${this.fragment}`,
    );
    const target = heading ?? node;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest" });
  }
}
