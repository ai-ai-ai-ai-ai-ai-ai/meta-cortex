import MarkdownIt, {
  type MarkdownIt as MarkdownParser,
  type MarkdownItOptions,
} from "markdown-it";
import anchor from "markdown-it-anchor";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { type Cause, Effect, Match, Schema } from "effect";
import { GuideDiagram } from "./guide-diagram";
import {
  GuideContent,
  ReaderNoticeKind,
  type ReaderNotice,
  type GuideDocument,
  type GuideDocumentPath,
  type GuideText,
  type GuideSourceBase,
} from "./guide-content";

enum AnchorKind {
  NoAnchor = "NoAnchor",
  Anchor = "Anchor",
}
type DocumentAnchor =
  | { readonly kind: AnchorKind.NoAnchor }
  | { readonly kind: AnchorKind.Anchor; readonly fragment: string };
enum ClickDisposition {
  Embedded = "Embedded",
  Delegated = "Delegated",
}
interface AnchorFocus {
  readonly node: HTMLElement;
  readonly fragment: string;
}
interface ClickTarget {
  readonly node: HTMLElement;
  readonly event: MouseEvent;
}
interface ClickedElement extends ClickTarget {
  readonly target: Element;
}
interface OpenerHandlers {
  readonly onFailure: (error: Cause.UnknownError) => void;
  readonly onSuccess: () => void;
}
enum LinkHost {
  Native = "Native",
  Browser = "Browser",
}
enum LinkSurface {
  Embedded = "Embedded",
  External = "External",
}
export interface ReaderOptions {
  readonly documents: ReadonlyArray<GuideDocument>;
  readonly sourceBase: GuideSourceBase;
  readonly select: (path: GuideDocumentPath) => void;
  readonly notice: (notice: ReaderNotice) => void;
}
interface DocumentRender {
  readonly node: HTMLElement;
  readonly source: GuideDocument;
}
interface DocumentClick {
  readonly node: HTMLElement;
  readonly event: MouseEvent;
  readonly link: HTMLAnchorElement;
}
/** HTML-disabled Markdown and strict Mermaid preserve the original guide renderer. */
export class GuideMarkdown {
  private readonly parser: MarkdownParser;
  private anchor: DocumentAnchor = { kind: AnchorKind.NoAnchor };
  private readonly diagrams = new GuideDiagram();
  constructor(private readonly options: ReaderOptions) {
    const parserOptions: MarkdownItOptions = { html: false };
    this.parser = new MarkdownIt(parserOptions).use(anchor);
  }
  // Svelte's action contract requires (node, parameter); both are fixed external inputs.
  mount = (node: HTMLElement, source: GuideDocument) => {
    let current = source;
    const initial: DocumentRender = { node, source: current };
    this.render(initial);
    let stopDrawing = this.diagrams.render(node);
    const click = (event: MouseEvent): void => {
      const request: ClickTarget = { node, event };
      this.clicked(request);
    };
    node.addEventListener("click", click);
    return {
      update: (next: GuideDocument) => {
        stopDrawing();
        current = next;
        const request: DocumentRender = { node, source: current };
        this.render(request);
        this.focus(node);
        stopDrawing = this.diagrams.render(node);
      },
      destroy: () => {
        stopDrawing();
        node.removeEventListener("click", click);
      },
    };
  };
  private clicked(request: ClickTarget): void {
    Match.value(request.event.target).pipe(
      Match.when(Match.instanceOf(Element), (target) => {
        const element: ClickedElement = {
          ...request,
          target,
        };
        this.clickedElement(element);
      }),
      Match.orElse(() => {}),
    );
  }
  private clickedElement(request: ClickedElement): void {
    Match.value(request.target.closest("a")).pipe(
      Match.when(Match.instanceOf(HTMLAnchorElement), (link) => {
        const click: DocumentClick = {
          node: request.node,
          event: request.event,
          link,
        };
        this.follow(click);
      }),
      Match.orElse(() => {}),
    );
  }
  private render(request: DocumentRender): void {
    const { node, source } = request;
    // markdown-it escapes raw HTML and rejects unsafe URLs before DOM insertion.
    node.innerHTML = this.parser.render(source.markdown);
    for (const link of node.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const resolved = new URL(
        link.href,
        new URL(source.path, this.options.sourceBase),
      );
      // getAttribute retains relative paths instead of resolving them against the app origin.
      Match.value(link.getAttribute("href")).pipe(
        Match.when(Match.string, (href) => {
          link.href = new URL(
            href,
            new URL(source.path, this.options.sourceBase),
          ).href;
        }),
        Match.orElse(() => (link.href = resolved.href)),
      );
    }
    for (const link of node.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      switch (this.surface(new URL(link.href))) {
        case LinkSurface.Embedded:
          break;
        case LinkSurface.External:
          link.classList.add("guide-external-link");
          link.title = "Opens in your browser";
          break;
      }
    }
    for (const heading of node.querySelectorAll<HTMLElement>("[id]")) {
      heading.id = `guide-doc-${heading.id}`;
      heading.tabIndex = -1;
    }
  }
  private follow(request: DocumentClick): void {
    const { link, event, node } = request;
    const quiet: ReaderNotice = { kind: ReaderNoticeKind.Quiet };
    this.options.notice(quiet);
    const url = new URL(link.href);
    const document = this.options.documents.find((doc) => {
      const target = new URL(doc.path, this.options.sourceBase);
      return target.origin === url.origin && target.pathname === url.pathname;
    });
    switch (this.disposition(event)) {
      case ClickDisposition.Embedded:
        Match.value(document).pipe(
          Match.when(Match.defined, (document) => {
            event.preventDefault();
            this.anchor = this.documentAnchor(url);
            this.options.select(document.path);
            this.focus(node);
          }),
          Match.orElse(() => this.delegate(request)),
        );
        return;
      case ClickDisposition.Delegated:
        this.delegate(request);
    }
  }
  private disposition(event: MouseEvent): ClickDisposition {
    switch (
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      case true:
        return ClickDisposition.Embedded;
      case false:
        return ClickDisposition.Delegated;
    }
  }
  private documentAnchor(url: URL): DocumentAnchor {
    switch (url.hash.length) {
      case 0:
        return { kind: AnchorKind.NoAnchor };
      default:
        return { kind: AnchorKind.Anchor, fragment: url.hash.slice(1) };
    }
  }
  private delegate(request: DocumentClick): void {
    switch (this.host()) {
      case LinkHost.Native:
        request.event.preventDefault();
        this.external(new URL(request.link.href));
        return;
      case LinkHost.Browser:
        return;
    }
  }

  private host(): LinkHost {
    switch (isTauri()) {
      case true:
        return LinkHost.Native;
      case false:
        return LinkHost.Browser;
    }
  }
  private surface(url: URL): LinkSurface {
    const embedded = this.options.documents.find((document) => {
      const target = new URL(document.path, this.options.sourceBase);
      return target.origin === url.origin && target.pathname === url.pathname;
    });
    return Match.value(embedded).pipe(
      Match.when(Match.defined, () => LinkSurface.Embedded),
      Match.orElse(() => LinkSurface.External),
    );
  }
  private external(url: URL): void {
    const handlers: OpenerHandlers = this.openerHandlers(url);
    switch (url.protocol) {
      case "https:":
      case "http:":
        Effect.runFork(
          Effect.tryPromise(() => openUrl(url.href)).pipe(
            Effect.match(handlers),
          ),
        );
        return;
      default:
        this.report(
          Schema.decodeUnknownSync(GuideContent.TEXT)(
            "This link type is not supported in the guide.",
          ),
        );
    }
  }
  private openerHandlers(url: URL): OpenerHandlers {
    const handlers: OpenerHandlers = {
      onFailure: () =>
        this.report(
          Schema.decodeUnknownSync(GuideContent.TEXT)(
            `Could not open ${url.href}`,
          ),
        ),
      onSuccess: () => {},
    };
    return handlers;
  }
  private report(message: GuideText): void {
    const notice: ReaderNotice = { kind: ReaderNoticeKind.Reported, message };
    this.options.notice(notice);
  }
  private focus(node: HTMLElement): void {
    const anchor = this.anchor;
    switch (anchor.kind) {
      case AnchorKind.NoAnchor:
        this.focusElement(node);
        return;
      case AnchorKind.Anchor: {
        const request: AnchorFocus = { node, fragment: anchor.fragment };
        this.focusAnchor(request);
        return;
      }
    }
  }
  private focusAnchor(request: AnchorFocus): void {
    const heading = Array.from(
      request.node.querySelectorAll<HTMLElement>("[id]"),
    ).find((element) => element.id === `guide-doc-${request.fragment}`);
    Match.value(heading).pipe(
      Match.when(Match.instanceOf(HTMLElement), (target) =>
        this.focusElement(target),
      ),
      Match.orElse(() => this.focusElement(request.node)),
    );
  }
  private focusElement(target: HTMLElement): void {
    const options: FocusOptions = { preventScroll: true };
    const scroll: ScrollIntoViewOptions = { block: "nearest" };
    target.focus(options);
    target.scrollIntoView(scroll);
  }
}
