import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import { isTauri } from "@tauri-apps/api/core";
import { GuideDiagram } from "./guide-diagram";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Effect, Match } from "effect";
import type { GuideDocument } from "./contracts";

export class GuideMarkdown {
  private readonly parser = new MarkdownIt({ html: false }).use(anchor);
  private fragment = "";
  private readonly diagrams = new GuideDiagram();
  private readonly sourceBase: string = import.meta.env.VITE_GUIDE_SOURCE_BASE;
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
              this.follow(element, event, node);
            }),
            Match.orElse(() => {}),
          );
        }),
        Match.orElse(() => {}),
      );
    };
    const disclosure = node.closest("details");
    const draw = () => {
      Match.value(disclosure?.open ?? true).pipe(
        Match.when(true, () => this.diagrams.render(node)),
        Match.orElse(() => {}),
      );
    };
    disclosure?.addEventListener("toggle", draw);
    node.addEventListener("click", click);
    draw();
    return {
      update: (next: GuideDocument) => {
        current = next;
        this.render(node, current);
        this.focus(node);
        draw();
      },
      destroy: () => {
        node.removeEventListener("click", click);
        disclosure?.removeEventListener("toggle", draw);
      },
    };
  };

  private render(node: HTMLElement, source: GuideDocument): void {
    // Raw HTML is disabled; markdown-it escapes content and rejects unsafe URLs.
    node.innerHTML = this.parser.render(source.markdown);
    for (const link of node.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const url = URL.parse(
        link.getAttribute("href") ?? "",
        new URL(source.path, this.sourceBase),
      );
      Match.value(url).pipe(
        Match.when(Match.defined, (resolved) => {
          link.href = resolved.href;
        }),
        Match.orElse(() => link.removeAttribute("href")),
      );
    }
    for (const heading of node.querySelectorAll<HTMLElement>("[id]")) {
      heading.id = `guide-doc-${heading.id}`;
    }
  }

  private follow(
    link: HTMLAnchorElement,
    event: MouseEvent,
    node: HTMLElement,
  ): void {
    this.notice("");
    const url = new URL(link.href);
    const document = this.documents.find((doc) => {
      const target = new URL(doc.path, this.sourceBase);
      return target.origin === url.origin && target.pathname === url.pathname;
    });
    const ordinaryClick =
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey;
    Match.value({ document, ordinaryClick }).pipe(
      Match.when(
        { document: Match.defined, ordinaryClick: true },
        ({ document }) => {
          event.preventDefault();
          this.fragment = url.hash.slice(1);
          this.select(document.path);
          this.focus(node);
        },
      ),
      Match.orElse(() => {
        Match.value(isTauri()).pipe(
          Match.when(true, () => {
            event.preventDefault();
            this.external(url);
          }),
          Match.orElse(() => {}),
        );
      }),
    );
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
