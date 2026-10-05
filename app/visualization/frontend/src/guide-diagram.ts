import { Effect, Match } from "effect";

export class GuideDiagram {
  render(node: HTMLElement): void {
    const blocks = Array.from(
      node.querySelectorAll<HTMLElement>("pre > code.language-mermaid"),
    );
    Effect.runFork(Effect.forEach(blocks, (code) => this.draw(code)));
  }

  private draw(code: HTMLElement) {
    return Effect.tryPromise(() => import("mermaid")).pipe(
      Effect.flatMap(({ default: mermaid }) => {
        const theme = Match.value(
          window.matchMedia("(prefers-color-scheme: dark)").matches,
        ).pipe(
          Match.when(true, () => "dark" as const),
          Match.orElse(() => "default" as const),
        );
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme,
          fontSize: 17,
          suppressErrorRendering: true,
        });
        return Effect.tryPromise(() =>
          mermaid.render(
            `guide-diagram-${crypto.randomUUID()}`,
            code.textContent ?? "",
          ),
        );
      }),
      Effect.match({
        onFailure: () => this.failed(code),
        onSuccess: ({ svg }) => this.replace(code, svg),
      }),
    );
  }

  private replace(code: HTMLElement, svg: string): void {
    const diagram = document.createElement("div");
    diagram.className = "guide-diagram";
    diagram.innerHTML = svg;
    for (const image of diagram.querySelectorAll("svg")) {
      const width = image.getAttribute("viewBox")?.split(/\s+/).at(2) ?? "600";
      image.style.width = `${width}px`;
    }
    code.parentElement?.replaceWith(diagram);
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
