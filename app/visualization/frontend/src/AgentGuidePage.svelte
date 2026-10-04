<script lang="ts">
  import { onMount } from "svelte";
  import { DashboardApi } from "./api";
  import { GuideController, GuideLoad } from "./guide-state.svelte";
  import { GuideLook } from "./agent-guide";
  import AgentGuideView from "./AgentGuideView.svelte";
  interface Props {
    onback: () => void;
  }
  let { onback }: Props = $props();
  const controller = new GuideController(new DashboardApi());
  onMount(() => {
    controller.read();
    return () => controller.stop();
  });
</script>

<div class="app">
  <header class="topbar">
    <button class="small-control" onclick={onback}
      >← {GuideLook.TEXT.back}</button
    ><strong>{GuideLook.TEXT.title}</strong>
  </header>
  <main class="page">
    {#if controller.state.kind === GuideLoad.Ready}
      <AgentGuideView guide={controller.state.guide} />
    {:else if controller.state.kind === GuideLoad.Failed}
      <p role="alert">{controller.state.failure.message}</p>
      <button onclick={() => controller.read()}>{GuideLook.TEXT.retry}</button>
    {:else}<p role="status">{GuideLook.TEXT.loading}</p>{/if}
  </main>
</div>
