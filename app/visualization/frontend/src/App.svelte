<script lang="ts">
  import Dashboard from "./Dashboard.svelte";
  import AgentGuidePage from "./AgentGuidePage.svelte";
  import { GuideRoute } from "./agent-guide";
  let route = $state(GuideRoute.Dashboard);
</script>

{#if route === GuideRoute.Guide}
  <AgentGuidePage onback={() => (route = GuideRoute.Dashboard)} />
{:else}
  <Dashboard onguide={() => (route = GuideRoute.Guide)} />
{/if}
