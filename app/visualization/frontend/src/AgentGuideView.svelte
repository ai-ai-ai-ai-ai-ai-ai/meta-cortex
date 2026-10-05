<script lang="ts">
  import { Schema } from "effect";
  import {
    GuideTeamId,
    GuideContent,
    type AgentGuide,
    type GuideDocumentPath,
  } from "./guide-content";
  import { GuideLook } from "./agent-guide";
  import GuideDocumentView from "./GuideDocumentView.svelte";
  import "./agent-guide.css";
  interface Props {
    guide: AgentGuide;
  }
  let { guide }: Props = $props();
  let selected = $state(
    Schema.decodeUnknownSync(GuideContent.PATH)(
      "teams/gizmo-team/agents/gizmo-prime/AGENTS.md",
    ),
  );
  let look = $derived(new GuideLook(guide));
  function select(path: GuideDocumentPath): void {
    selected = path;
    look.revealAfterRender();
  }
</script>

<section class="agent-guide">
  <div class="guide-heading">
    <p class="eyebrow">{GuideLook.TEXT.structure}</p>
    <h1>{GuideLook.TEXT.title}</h1>
    <p>{GuideLook.TEXT.select}</p>
  </div>
  <div class="guide-layout">
    <div class="guide-graph" aria-label={GuideLook.TEXT.structure}>
      <div class="guide-hierarchy">
        <div class="guide-host">{GuideLook.TEXT.host}</div>
        {#each look.agents(GuideTeamId.Gizmo) as agent (agent.path)}
          <p class="guide-direction">
            ↑ {GuideLook.TEXT.reportsTo}
            {agent.reports_to}
          </p>
          <button
            class="guide-node guide-coordinator"
            class:selected={selected === agent.path}
            aria-pressed={selected === agent.path}
            onclick={() => select(agent.path)}>{agent.label}</button
          >
        {/each}
      </div>
      <div class="guide-teams">
        {#each GuideLook.GROUPS as team (team)}
          <section class="guide-team" aria-label={GuideLook.TEAMS[team]}>
            <p class="guide-group-reports">
              ↑ {GuideLook.TEXT.reportsTo}
              {look.teamTargets(team).join(", ")}
            </p>
            <h2>
              {GuideLook.TEAMS[team]}<small>{GuideLook.TEXT.membership}</small>
            </h2>
            {#each look.agents(team) as agent (agent.path)}
              <button
                class="guide-node"
                class:selected={selected === agent.path}
                aria-pressed={selected === agent.path}
                onclick={() => select(agent.path)}>{agent.label}</button
              >
            {/each}
          </section>
        {/each}
      </div>
    </div>
    <aside
      id="guide-detail"
      class="guide-detail"
      tabindex="-1"
      aria-live="polite"
    >
      {#each look.selected(selected) as agent (agent.path)}
        <p class="eyebrow">{GuideLook.TEAMS[agent.team]}</p>
        <h2>{agent.label}</h2>
        <div class="guide-detail-sections">
          <dl class="guide-responsibility">
            <div>
              <dt>{GuideLook.TEXT.owns}</dt>
              <dd>{agent.responsibility}</dd>
            </div>
            <div>
              <dt>{GuideLook.TEXT.reports}</dt>
              <dd>{agent.reports_to}</dd>
            </div>
          </dl>
          <section class="guide-handoff" aria-label={GuideLook.TEXT.handoff}>
            <h3>{GuideLook.TEXT.handoff}</h3>
            <ol>
              {#each agent.handoff.split("\n") as step, index (index)}
                <li>{step}</li>
              {/each}
            </ol>
          </section>
        </div>
        {#each look.reviews(agent) as review (review.author)}
          <p class="guide-review">
            {#each look.selected(review.author) as author (author.path)}{author.label}{/each}
            → {#each look.selected(review.reviewer) as reviewer (reviewer.path)}{reviewer.label}{/each}<small
              >{GuideLook.TEXT.via} Team Gizmo</small
            >
          </p>
        {/each}
        {#each look.documents(agent) as document (document.path)}
          <section class="guide-document">
            <h3>{GuideLook.TEXT.documentation}</h3>
            {#key document.path}<GuideDocumentView
                source={document}
                documents={guide.documents}
                sourceBase={guide.sourceBase}
              />{/key}
          </section>
        {/each}
      {/each}
    </aside>
  </div>
</section>
