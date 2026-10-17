<script lang="ts">
  import { FocusState, type AgentFocus } from "./sky-focus.svelte";
  import { LeaseKind } from "./sky-ledger";
  interface Props {
    focus: AgentFocus;
    tone: string;
    team: string;
  }
  let { focus, tone, team }: Props = $props();
</script>

{#if focus.state === FocusState.Open}
  {#each focus.agent as agent (agent.key)}
    <div
      class="sky-focus"
      style:--team={tone}
      role="dialog"
      aria-label={`${agent.name} close-up`}
    >
      <button
        class="sky-focus-close"
        type="button"
        onclick={() => focus.close()}
      >
        <kbd>Esc</kbd> Back to the sky
      </button>
      <div class="sky-focus-nav">
        <button
          type="button"
          aria-label="Previous agent"
          onclick={() => focus.step(-1)}>‹</button
        >
        <span>{focus.index()}</span>
        <button
          type="button"
          aria-label="Next agent"
          onclick={() => focus.step(1)}>›</button
        >
      </div>
      {#each focus.caption as caption (caption.id)}
        <div class="sky-focus-caption" style:--caption={caption.color}>
          <span>{caption.title}</span>
          <small>{caption.detail}</small>
        </div>
      {/each}
      <aside class="sky-focus-panel" aria-label="Telemetry">
        <div class="sky-focus-kicker">Telemetry · live</div>
        <div class="sky-metric sky-metric-hero">
          <span>Velocity</span><b>{focus.telemetry.velocity}</b><i
            >events / min</i
          >
        </div>
        <div class="sky-metric-grid">
          <div class="sky-metric">
            <span>Temperature</span><b>{focus.telemetry.temperature}</b><i>K</i>
          </div>
          <div class="sky-metric">
            <span>Checks</span><b>{focus.telemetry.checks}</b><i
              >{focus.telemetry.failed}</i
            >
          </div>
          <div class="sky-metric">
            <span>Commits</span><b>{focus.telemetry.commits}</b><i
              >checkpoints</i
            >
          </div>
          <div class="sky-metric">
            <span>Completed</span><b>{focus.telemetry.done}</b><i>tasks</i>
          </div>
        </div>
        <div class="sky-spark">
          <span>Activity · last minute</span>
          <svg
            viewBox="0 0 300 56"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline points={focus.sparkline()} />
          </svg>
        </div>
        <div class="sky-focus-task">
          <span>Current task</span>
          <strong>{focus.telemetry.task}</strong>
          <small>{focus.telemetry.detail}</small>
          <div
            class="sky-glowbar"
            data-alarm={focus.telemetry.alarm === LeaseKind.Expired}
          >
            <i style:width={`${focus.telemetry.glow * 100}%`}></i>
          </div>
        </div>
        <div class="sky-focus-uptime">T+<b>{focus.telemetry.clock}</b></div>
        <ol class="sky-focus-log">
          {#each focus.log as line (line.id)}
            <li>
              <time>T+{line.clock}</time><b>{line.kind}</b><span
                >{line.text}</span
              >
            </li>
          {/each}
        </ol>
      </aside>
      <div class="sky-focus-lower">
        <div class="sky-focus-team">
          {team}{#if agent.worker}&nbsp;· worker {agent.worker}{/if}
        </div>
        <h2>{agent.name}</h2>
        <div class="sky-focus-line"></div>
        <p>
          Reports results, blockers and questions only to its coordinator. Team
          Gizmo relays evidence between agents.
        </p>
      </div>
    </div>
  {/each}
{/if}
