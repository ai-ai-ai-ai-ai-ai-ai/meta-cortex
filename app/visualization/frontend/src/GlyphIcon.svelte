<script lang="ts">
  import { GlyphIcons, type GlyphKind, type IconDraw } from "./sky-glyph";
  interface Props {
    kind: GlyphKind;
    heat: number;
    tint: string;
    size: number;
  }
  let { kind, heat, tint, size }: Props = $props();
  const icons = new GlyphIcons();
  function paint(canvas: HTMLCanvasElement): void {
    const request: IconDraw = {
      canvas,
      kind,
      heat,
      tint,
      size,
      ratio: Math.min(2, window.devicePixelRatio),
    };
    icons.draw(request);
  }
</script>

<canvas
  class="glyph-icon"
  style:width={`${size}px`}
  style:height={`${size}px`}
  aria-hidden="true"
  {@attach paint}
></canvas>
