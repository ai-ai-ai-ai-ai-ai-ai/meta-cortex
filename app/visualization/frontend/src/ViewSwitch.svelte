<script lang="ts">
  import { Sparkles } from "@lucide/svelte";
  import {
    ViewMode,
    type SwitchClick,
    type ViewChoice,
    type ViewModes,
  } from "./view-mode.svelte";
  interface Props {
    views: ViewModes;
  }
  let { views }: Props = $props();
  function classic(click: SwitchClick): void {
    const choice: ViewChoice = {
      mode: ViewMode.Classic,
      origin: views.originOf(click),
    };
    views.choose(choice);
  }
  function animated(click: SwitchClick): void {
    const choice: ViewChoice = {
      mode: ViewMode.Animated,
      origin: views.originOf(click),
    };
    views.choose(choice);
  }
</script>

<div class="view-switch" data-mode={views.mode} role="group" aria-label="View">
  <span class="view-switch-thumb" aria-hidden="true"></span>
  <button
    type="button"
    aria-pressed={views.mode === ViewMode.Classic}
    onclick={classic}>Classic</button
  >
  <button
    type="button"
    aria-pressed={views.mode === ViewMode.Animated}
    onclick={animated}
    ><Sparkles class="size-3" aria-hidden="true" />Animated</button
  >
</div>
