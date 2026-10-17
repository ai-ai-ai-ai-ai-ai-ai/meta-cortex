<script lang="ts">
  import { untrack } from "svelte";
  import { Effect, Match } from "effect";
  import type { FeatureCard, RepositorySelection } from "./contracts";
  import { DashboardApi } from "./api";
  import { SkyFeed, type SkyFeedRequest } from "./sky-feed.svelte";
  import {
    KeyPanel,
    Motion,
    PlayMode,
    SkyStage,
    StageVisibility,
    TipKind,
    type PointerAt,
    type TrackPointer,
    type StageLayout,
  } from "./sky-stage.svelte";
  import { FocusState } from "./sky-focus.svelte";
  import { Glyphs } from "./sky-glyph";
  import { ViewMode, type Origin } from "./view-mode.svelte";
  import GlyphIcon from "./GlyphIcon.svelte";
  import SkyTip from "./SkyTip.svelte";
  import SkyFocusPanel from "./SkyFocusPanel.svelte";
  import "./sky.css";

  interface Props {
    repository: RepositorySelection;
    cards: ReadonlyArray<FeatureCard>;
    mode: ViewMode;
    origin: Origin;
  }
  let { repository, cards, mode, origin }: Props = $props();
  const stage = new SkyStage();
  const feed = untrack(() => {
    const request: SkyFeedRequest = { api: new DashboardApi(), repository };
    return new SkyFeed(request);
  });
  let key = $state<KeyPanel>(KeyPanel.Closed);
  /** Mounted while Animated and through the closing transition only. */
  let presence = $state<StageVisibility>(StageVisibility.Hidden);
  /** Where the app's top bar ends; the sky's chrome sits below it. */
  let top = $state(64);

  // Read the workflows while the sky is visible; App's live refresh renews `cards`.
  $effect(() => {
    switch (mode) {
      case ViewMode.Animated:
        feed.read(cards);
        return () => feed.stop();
      case ViewMode.Classic:
        return;
    }
  });
  $effect(() => {
    for (const ledger of feed.ledger) untrack(() => stage.load(ledger));
  });
  // The sky opens from the switch and closes back into it.
  $effect(() => {
    switch (mode) {
      case ViewMode.Animated:
        untrack(() => {
          presence = StageVisibility.Shown;
          stage.show(StageVisibility.Shown);
          stage.enter();
        });
        return;
      case ViewMode.Classic:
        untrack(() => stage.leave());
        return Effect.runCallback(
          Effect.sleep("1100 millis").pipe(
            Effect.andThen(
              Effect.sync(() => {
                stage.show(StageVisibility.Hidden);
                presence = StageVisibility.Hidden;
              }),
            ),
          ),
        );
    }
  });

  /** The frame loop and canvas size live as long as the canvas. */
  function sky(canvas: HTMLCanvasElement): () => void {
    stage.attach(canvas);
    const observer = new ResizeObserver(() => resize(canvas));
    observer.observe(canvas);
    resize(canvas);
    let last = performance.now();
    let frame = requestAnimationFrame(loop);
    function loop(now: number): void {
      stage.tick(Math.min(0.05, (now - last) / 1000));
      last = now;
      frame = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }
  function resize(canvas: HTMLCanvasElement): void {
    const ratio = Math.min(2, window.devicePixelRatio);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const wide = Number(width > 980);
    top = Match.value(document.querySelector("header.topbar")).pipe(
      Match.when(Match.null, () => 64),
      Match.orElse((bar) => bar.getBoundingClientRect().bottom),
    );
    const layout: StageLayout = {
      viewport: { width, height },
      bounds: {
        left: 320 * wide,
        right: width - 340 * wide,
        top: top + 14,
        // Clear of the dock and, on wide screens, the event ticker above it.
        bottom: height - 150 - 60 * wide,
      },
      ratio,
    };
    stage.layout(layout);
  }
  function track(canvas: HTMLCanvasElement): void {
    stage.attachTrack(canvas);
  }
  function at(event: PointerEvent): PointerAt {
    return { x: event.offsetX, y: event.offsetY };
  }
  function scrub(event: TrackPointer): void {
    stage.seek(event.offsetX / Math.max(1, event.currentTarget.clientWidth));
  }
  function keys(event: KeyboardEvent): void {
    switch (mode) {
      case ViewMode.Classic:
        return;
      case ViewMode.Animated:
        break;
    }
    switch (event.key) {
      case "Escape":
        return escape();
      case "ArrowRight":
        return focusStep(1);
      case "ArrowLeft":
        return focusStep(-1);
      case " ":
        event.preventDefault();
        return stage.toggle();
      case "r":
        return stage.replay();
    }
  }
  function escape(): void {
    switch (stage.focus.state) {
      case FocusState.Open:
        return stage.focus.close();
      case FocusState.Closed:
        return stage.sky();
    }
  }
  function focusStep(offset: number): void {
    switch (stage.focus.state) {
      case FocusState.Open:
        return stage.focus.step(offset);
      case FocusState.Closed:
        return;
    }
  }
  function toggleKey(): void {
    switch (key) {
      case KeyPanel.Closed:
        key = KeyPanel.Open;
        return;
      case KeyPanel.Open:
        key = KeyPanel.Closed;
    }
  }
</script>

<svelte:window onkeydown={keys} />

{#if presence === StageVisibility.Shown}
  <section
    class="sky"
    data-mode={mode}
    data-focus={stage.focus.state}
    style:--ox={`${origin.x}px`}
    style:--oy={`${origin.y}px`}
    style:--sky-top={`${top}px`}
    aria-label="Animated view"
    aria-hidden={mode === ViewMode.Classic}
    inert={mode === ViewMode.Classic}
  >
    <canvas
      class="sky-canvas"
      aria-label={`Constellation of ${repository.name}: ${stage.hud.summary}`}
      {@attach sky}
      onpointermove={(event) => stage.pointer(at(event))}
      onpointerleave={() => stage.leavePointer()}
      onpointerdown={(event) => stage.press(at(event))}
      onpointerup={(event) => stage.release(at(event))}
      onwheel={(event) => {
        event.preventDefault();
        stage.zoom(event.deltaY);
      }}
      ondblclick={() => stage.sky()}
    ></canvas>

    <section class="sky-rail sky-rail-left" aria-label="Features">
      <div class="sky-kicker">
        {repository.name} · {stage.hud.features.length} features
      </div>
      <div
        class="sky-headline"
        style:--tone={stage.conditionColor(stage.hud.condition)}
      >
        <i></i><b>{SkyStage.CONDITION_LABEL[stage.hud.condition]}</b>
      </div>
      <p class="sky-summary">{stage.hud.summary}</p>
      <div class="sky-features">
        {#each stage.hud.features as feature (feature.id)}
          <button
            type="button"
            class="sky-feature"
            aria-pressed={feature.focused > 0}
            onclick={() => stage.fly(feature.id)}
            onmouseenter={() => stage.hoverNode(`f:${feature.id}`)}
            onmouseleave={() => stage.clearHover()}
          >
            <i data-condition={feature.condition}></i>
            <b>{feature.title}</b>
            <small>{feature.done}/{feature.total}</small>
            <span class="sky-stack" aria-hidden="true">
              {#each Object.entries(feature.counts) as [state, count] (state)}
                {#if count > 0}<span style:flex-grow={count} data-state={state}
                  ></span>{/if}
              {/each}
            </span>
          </button>
        {/each}
      </div>
      <button type="button" class="sky-whole" onclick={() => stage.sky()}
        >⟲ Whole sky</button
      >
    </section>

    <section class="sky-rail sky-rail-right" aria-label="Now">
      <h3 data-tone="red">
        Attention<span>{stage.hud.attention.length}</span>
      </h3>
      {#each stage.hud.attention as row (row.id)}
        <button
          type="button"
          class="sky-row"
          onclick={() => stage.openTask(row.id)}
          onmouseenter={() => stage.hoverNode(`k:${row.id}`)}
          onmouseleave={() => stage.clearHover()}
        >
          <GlyphIcon
            kind={row.glyph}
            heat={row.heat}
            tint={row.tint}
            size={18}
          />
          <b>{row.objective}</b><time>{row.age}</time>
          <small>{row.agent} · <em>{row.detail}</em></small>
        </button>
      {:else}
        <p class="sky-empty">Nothing needs you</p>
      {/each}
      <h3>Burning<span>{stage.hud.burning.length}</span></h3>
      {#each stage.hud.burning as row (row.id)}
        <button
          type="button"
          class="sky-row"
          onclick={() => stage.openTask(row.id)}
          onmouseenter={() => stage.hoverNode(`k:${row.id}`)}
          onmouseleave={() => stage.clearHover()}
        >
          <GlyphIcon
            kind={row.glyph}
            heat={row.heat}
            tint={row.tint}
            size={18}
          />
          <b>{row.objective}</b><time>{row.age}</time>
          <small>{row.agent} · {row.detail}</small>
          <span class="sky-glowbar"
            ><i style:width={`${row.heat * 100}%`}></i></span
          >
        </button>
      {:else}
        <p class="sky-empty">—</p>
      {/each}
      <h3 data-tone="gold">
        Awaiting review<span>{stage.hud.review.length}</span>
      </h3>
      {#each stage.hud.review as row (row.id)}
        <button
          type="button"
          class="sky-row"
          onclick={() => stage.openTask(row.id)}
          onmouseenter={() => stage.hoverNode(`k:${row.id}`)}
          onmouseleave={() => stage.clearHover()}
        >
          <GlyphIcon
            kind={row.glyph}
            heat={row.heat}
            tint={row.tint}
            size={18}
          />
          <b>{row.objective}</b><time>{row.age}</time>
          <small>{row.agent} · {row.detail}</small>
        </button>
      {:else}
        <p class="sky-empty">—</p>
      {/each}
    </section>

    <ol class="sky-ticker" aria-live="polite">
      {#each stage.hud.ticker as line (line.id)}
        <li>
          <time>{line.clock}</time><b style:color={line.color}>{line.who}</b
          ><span>{line.text}</span>
        </li>
      {/each}
    </ol>

    <button
      type="button"
      class="sky-keybutton"
      aria-expanded={key === KeyPanel.Open}
      onclick={toggleKey}>Key</button
    >
    {#if key === KeyPanel.Open}
      <section class="sky-key" aria-label="How to read the sky">
        <div class="sky-kicker">How to read the sky</div>
        <ul>
          {#each Glyphs.LEGEND as entry (entry.kind)}
            <li>
              <GlyphIcon
                kind={entry.kind}
                heat={0.8}
                tint="#ff7aa2"
                size={26}
              /><span>{entry.label}</span>
            </li>
          {/each}
        </ul>
        <hr />
        <ul>
          {#each SkyStage.MARKS as [mark, color, label] (label)}
            <li><b style:color>{mark}</b><span>{label}</span></li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="sky-dock" aria-label="Timeline">
      <div class="sky-transport">
        <button
          type="button"
          onclick={() => stage.replay()}
          title="Replay the whole history (R)">⟲ Replay</button
        >
        <button
          type="button"
          onclick={() => stage.toggle()}
          aria-label="Play or pause (Space)"
        >
          {#if stage.motion === Motion.Playing}❚❚{:else}▶{/if}
        </button>
        <span class="sky-separator"></span>
        {#each SkyStage.PACES as [pace, label] (pace)}
          <button
            type="button"
            aria-pressed={stage.pace === pace}
            onclick={() => stage.setPace(pace)}
            title={`Replay the whole history in ${label}`}>{label}</button
          >
        {/each}
      </div>
      <canvas
        class="sky-track"
        aria-label="Activity over the recorded history; drag to scrub"
        {@attach track}
        onpointerdown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          stage.startScrub();
          scrub(event);
        }}
        onpointermove={(event) => {
          switch (event.buttons === 1) {
            case true:
              return scrub(event);
            case false:
              return;
          }
        }}
        onpointerup={() => stage.endScrub()}
      ></canvas>
      <div class="sky-clock">
        <b>{stage.hud.clock}</b>
        <button
          type="button"
          class="sky-live"
          data-live={stage.mode === PlayMode.Live}
          onclick={() => stage.live()}
        >
          <i></i>{#if stage.mode === PlayMode.Live}LIVE{:else}GO LIVE · {stage
              .hud.behind}{/if}
        </button>
      </div>
    </section>

    {#if stage.tip.kind === TipKind.Shown}
      <SkyTip
        card={stage.card(stage.tip.hit)}
        x={Math.min(stage.tip.x + 18, window.innerWidth - 300)}
        y={Math.min(stage.tip.y + 18, window.innerHeight - 240)}
      />
    {/if}

    {#each stage.focus.agent as agent (agent.key)}
      <SkyFocusPanel
        focus={stage.focus}
        tone={stage.teamColor(agent.team)}
        team={stage.teamName(agent.team)}
      />
    {/each}

    {#each feed.failures as failure (failure.message)}
      <p class="sky-stale" role="status">
        The sky shows the last successful read. {failure.message}
      </p>
    {/each}
  </section>
{/if}
