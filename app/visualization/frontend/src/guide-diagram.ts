import { type Cause, Effect, Match } from "effect";
import type { MermaidConfig, Mermaid, RenderResult } from "mermaid";
interface DiagramReplacement {
  readonly code: HTMLElement;
  readonly svg: string;
}
interface DiagramRender {
  readonly code: HTMLElement;
  readonly mermaid: Mermaid;
}
interface DiagramHandlers {
  readonly onFailure: (error: Cause.UnknownError) => void;
  readonly onSuccess: (result: RenderResult) => void;
}
export class GuideDiagram {
  render(node: HTMLElement): () => void {
    const blocks = Array.from(
      node.querySelectorAll<HTMLElement>("pre > code.language-mermaid"),
    );
    return Effect.runCallback(
      Effect.forEach(blocks, (code) => this.draw(code)),
    );
  }
  private draw(code: HTMLElement) {
    const handlers: DiagramHandlers = this.handlers(code);
    return Effect.tryPromise(() => import("mermaid")).pipe(
      Effect.flatMap((module) => {
        const request: DiagramRender = { code, mermaid: module.default };
        return this.renderCode(request);
      }),
      Effect.match(handlers),
    );
  }
  private renderCode(request: DiagramRender) {
    const theme = Match.value(
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    ).pipe(
      Match.when(true, () => "dark" as const),
      Match.orElse(() => "default" as const),
    );
    const config: MermaidConfig = {
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      fontSize: 17,
      suppressErrorRendering: true,
    };
    request.mermaid.initialize(config);
    return Effect.tryPromise(() =>
      request.mermaid.render(
        `guide-diagram-${crypto.randomUUID()}`,
        this.source(request.code),
      ),
    );
  }
  private handlers(code: HTMLElement): DiagramHandlers {
    const handlers: DiagramHandlers = {
      onFailure: () => this.failed(code),
      onSuccess: ({ svg }) => {
        const request: DiagramReplacement = { code, svg };
        this.replace(request);
      },
    };
    return handlers;
  }
  private replace(request: DiagramReplacement): void {
    const diagram = document.createElement("div");
    diagram.className = "guide-diagram";
    diagram.innerHTML = request.svg;
    for (const image of diagram.querySelectorAll("svg")) {
      this.size(image);
    }
    request.code.parentElement?.replaceWith(diagram);
  }
  private source(code: HTMLElement): string {
    return Match.value(code.textContent).pipe(
      Match.when(Match.string, (source) => source),
      Match.orElse(() => ""),
    );
  }
  private size(image: SVGSVGElement): void {
    const width = image.getAttribute("viewBox")?.split(/\s+/).at(2);
    Match.value(width).pipe(
      Match.when(Match.string, (value) => {
        image.style.width = `${value}px`;
      }),
      Match.orElse(() => {}),
    );
  }

  private failed(code: HTMLElement): void {
    code.classList.remove("language-mermaid");
    const message = document.createElement("p");
    message.className = "guide-diagram-error";
    message.textContent =
      "This diagram could not be rendered. Its Mermaid source is shown below.";
    code.parentElement?.before(message);
  }
}
