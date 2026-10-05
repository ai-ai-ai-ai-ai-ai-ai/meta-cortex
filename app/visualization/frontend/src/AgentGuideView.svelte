<script lang="ts">
  import { tick } from "svelte";
  import type { AgentGuide } from "./contracts";
  import { GuideLook } from "./agent-guide";
  import { AgentLook } from "./presentation";
  import "./agent-guide.css";
  interface Props {
    guide: AgentGuide;
  }
  let { guide }: Props = $props();
  let selected = $state("GizmoPrime");
  let look = $derived(new GuideLook(guide));
  async function select(role: string): Promise<void> {
    selected = role;
    await tick();
    look.reveal();
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
        {#each look.agents("Gizmo") as agent (agent.agent.role)}
          <p class="guide-direction">
            ↑ {GuideLook.TEXT.reportsTo}
            {look.target(agent.reports_to)}
          </p>
          <button
            class="guide-node guide-coordinator"
            class:selected={selected === agent.agent.role}
            aria-pressed={selected === agent.agent.role}
            onclick={() => select(agent.agent.role)}>{agent.label}</button
          >
        {/each}
      </div>
      <div class="guide-teams">
        {#each guide.teams.filter((team) => team.team !== "Gizmo") as team (team.team)}
          <section class="guide-team" aria-label={GuideLook.TEAMS[team.team]}>
            <p class="guide-group-reports">
              ↑ {GuideLook.TEXT.reportsTo}
              {look.teamTargets(team.team).join(", ")}
            </p>
            <h2>
              {GuideLook.TEAMS[team.team]}<small
                >{GuideLook.TEXT.membership}</small
              >
            </h2>
            {#each look.agents(team.team) as agent (agent.agent.role)}
              <button
                class="guide-node"
                class:selected={selected === agent.agent.role}
                aria-pressed={selected === agent.agent.role}
                onclick={() => select(agent.agent.role)}>{agent.label}</button
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
      {#each look.selected(selected) as agent (agent.agent.role)}
        <p class="eyebrow">{GuideLook.TEAMS[agent.agent.team]}</p>
        <h2>{agent.label}</h2>
        <div class="guide-detail-sections">
          <dl class="guide-responsibility">
            <div>
              <dt>{GuideLook.TEXT.owns}</dt>
              <dd>{agent.responsibility}</dd>
            </div>
            <div>
              <dt>{GuideLook.TEXT.reports}</dt>
              <dd>{look.target(agent.reports_to)}</dd>
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
        {#each look.reviews(agent) as review (review.author.role)}
          <p class="guide-review">
            {new AgentLook(review.author).name()} → {new AgentLook(
              review.reviewer,
            ).name()}<small
              >{GuideLook.TEXT.via} {AgentLook.ROLES[review.coordinator]}</small
            >
          </p>
        {/each}
        {#each look.documents(agent) as document (document.path)}
          <details class="guide-document">
            <summary>{GuideLook.TEXT.documentation}</summary>
            <p>{document.path}</p>
            <pre>{document.markdown}</pre>
          </details>
        {/each}
      {/each}
    </aside>
  </div>
</section>
