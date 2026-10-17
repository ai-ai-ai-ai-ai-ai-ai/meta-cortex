# Homeostat design code

This document governs Homeostat's visual language, starting with the
**Animated view** (the constellation). Read it before changing the sky, its
chrome or its motion, and update it in the same change when a rule moves.

## Principles

1. **Every mark is evidence.** Each colour, size, glow and animation maps to a
   recorded ledger field. Do not invent progress, estimates or decorative data.
   The ledger has no completion percentage, so the sky never shows one.
2. **Attention outranks progress.** Blockers, lapsed leases and failed checks
   are always visible and always labelled. Everything else may stay quiet.
3. **Calm at rest, vivid on events.** The resting sky breathes slowly. Motion
   spikes only when the ledger records something, then settles.
4. **Legibility beats density.** Text never overlaps. When labels compete for
   room, the less important one is not drawn.
5. **Classic stays the source of detail.** The Animated view shows the shape
   and the pulse of the work. The Classic view keeps logs, evidence and
   workflow detail. Neither replaces the other.

## Where things live

| File                                                                                          | Owns                                                                                                           |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/sky-ledger.ts`                                                                           | Orders every feature's `revision_log` and folds it to an instant: tasks, agents, leases, condition, attention. |
| `src/sky-scene.ts`                                                                            | The constellation: layout, filaments, clusters, energy, cues, comets, labels, callouts, hit testing, camera.   |
| `src/sky-glyph.ts`                                                                            | One drawing per task state, shared by the scene, the rails and the key.                                        |
| `src/sky-paint.ts`                                                                            | Glows, diffraction spikes, tails, starfield, sparks, colour arithmetic.                                        |
| `src/sky-focus.svelte.ts`                                                                     | The agent close-up: star, supernova, coordinator links, telemetry.                                             |
| `src/sky-stage.svelte.ts`                                                                     | Playback, replay pacing, transitions, pointer input, the HUD snapshot.                                         |
| `src/sky-feed.svelte.ts`                                                                      | Reads the workflows behind the sky through `DashboardApi`.                                                     |
| `src/SkyView.svelte`, `src/SkyFocusPanel.svelte`, `src/SkyTip.svelte`, `src/GlyphIcon.svelte` | Markup for the sky's chrome.                                                                                   |
| `src/ViewSwitch.svelte`, `src/view-mode.svelte.ts`                                            | The Classic ⇄ Animated switch in the top bar.                                                                  |
| `src/sky.css`                                                                                 | Every sky style. The switch styles live with the top bar in `src/styles.css`.                                  |

## Data to visuals

The sky is a fold of the ledger, so live updates, scrubbing and replay share one
code path. Never read state that the fold does not produce.

| Ledger field                            | Visual                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Feature card (`current`)                | A feature star with a ring of its task inventory, segmented by flow state. |
| `TaskV3.ownership.assignment.agent`     | The team and agent branch a task hangs from.                               |
| `reports_to`                            | The coordinator that the agent's laser links reach in the close-up.        |
| `FeedEntry.state` (`active` phase)      | Working or blocked; blocked carries its recorded reason.                   |
| `Assignment.expires_at`                 | A lapsed lease turns a working star into _signal lost_.                    |
| Entry recency                           | Glow: 1 right after an event, fading over about 45 seconds.                |
| `progress`, `checkpoint`, passed checks | Star size: how much work is recorded.                                      |
| `Check.outcome`                         | Green ring for a pass; red burst and a floating `✕ command` for a failure. |
| `Checkpoint` (`git`)                    | A cyan diamond leaves the star; the short SHA appears in tooltips.         |
| `ready`, `integrated`, `completed`      | Gold ripples, a gold pulse to the core, then a supernova and a fixed star. |
| `requeued`                              | The star falls back toward its agent with `↺ requeued`.                    |
| `FeedEntry.worker`                      | The worker shown on the agent's tooltip and close-up.                      |

## Visual vocabulary

### Space and chrome

The sky is a single dark world in both app themes. Its tokens are defined on
`.sky` in `src/sky.css`:

| Token                        | Value                               | Use                                               |
| ---------------------------- | ----------------------------------- | ------------------------------------------------- |
| `--sky-space`                | `#020309`                           | Background behind the starfield.                  |
| `--sky-ink`                  | `#edf1fb`                           | Primary text.                                     |
| `--sky-dim`                  | `rgba(207, 224, 255, 0.58)`         | Secondary text, labels.                           |
| `--sky-faint` / `--sky-line` | 16% / 9% ink                        | Borders and separators.                           |
| `--sky-glass`                | `rgba(8, 10, 22, 0.62)` + 14px blur | Rails, dock and key.                              |
| `--sky-gold`                 | `#ffe2a8`                           | Coordination: Gizmo Prime, assignments, handoffs. |
| `--sky-red`                  | `#ff4d63`                           | Attention only. Never decorative.                 |

Typography uses the app's own faces: Inter (or the system sans) for names and
headlines, JetBrains Mono (or the system monospace) for labels, numbers and
evidence. The Tauri CSP forbids web fonts; do not add any.

### Teams

| Team        | Colour    |
| ----------- | --------- |
| Development | `#ff7aa2` |
| AI & Docs   | `#ffc76b` |
| Security    | `#6ff0c4` |
| SRE         | `#6cb8ff` |
| Delivery    | `#bd9dff` |
| Gizmo       | `#ffe2a8` |
| Unrecorded  | `#8a97b8` |

### Task glyphs

Defined once in `Glyphs`; the key renders the same drawings.

| Glyph      | Drawing                                                                | Meaning                                                     |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Queued     | Hollow ring                                                            | Not lit yet.                                                |
| Working    | Star whose colour follows the heat ramp; size grows with recorded work | Recent activity glows hotter.                               |
| Stalled    | Dim blue star with a turning dashed ring                               | Working, but the lease expired.                             |
| Blocked    | Flickering red star with a ring and halo                               | Blocked with a recorded reason.                             |
| Ready      | Gold star with expanding ripples                                       | Waiting for Gizmo Prime's review.                           |
| Integrated | White-hot star with an orbiting cyan diamond                           | Commit landed.                                              |
| Completed  | Team-tinted star in its agent's spiral cluster                         | Finished; bright for 20 seconds, then steady and twinkling. |
| Cancelled  | Small grey cross                                                       | Cancelled.                                                  |

The heat ramp runs ember → flame → white-hot → blue-white
(`Palette.HEAT`). It only expresses recency; it is not a status colour.

### Structure

- Gizmo Prime is the core. Features branch from it, then teams, agents and tasks.
- Branches are quadratic curves that all bend the same way, so the sky swirls.
- A feature's branch length grows with its task count; bigger work reaches
  further, which keeps the sky asymmetric.
- Finished tasks leave the branch and settle into a golden-angle spiral beside
  their agent, joined in completion order by a faint dotted figure. Inner stars
  orbit faster. Only the newest 16 finished stars per agent branch are drawn.
- Idle agents are comets orbiting the core. A claim sends the comet to its
  task; a laser joins them once the comet arrives.
- Feature nebulae are tinted by condition: red for attention, amber for active,
  gold for waiting, blue for finished.

## Motion

| Moment             | Rule                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Ambient            | The sky turns at 0.006 rad/s and breathes ±1.2% in zoom. Stars twinkle slowly.                                                              |
| Event cues         | 0.6–1.6 seconds, cubic ease-out. One cue per event; no looping effects.                                                                     |
| Energy             | Three motes per working task flow outward; three gold motes flow back from handoffs.                                                        |
| Switch to Animated | The sky opens as a circle from the pressed button (1.05 s), hyperspace streaks run for 1.5 s, and the constellation blooms out of the core. |
| Switch to Classic  | The camera flies forward and the sky closes back into the button.                                                                           |
| Replay             | Replays the whole history in 90, 45 or 15 seconds and skips idle stretches.                                                                 |

- Diffraction spikes stay quiet: thin, half strength, fading fast from the core.
  Completed stars show spikes only while fresh. Teams have none.
- `prefers-reduced-motion` removes the CSS transitions; keep any new motion
  behind the same media query.
- The frame loop runs only while the sky is mounted. The Classic view unmounts
  it after the closing transition, so it costs nothing.

## Text

- Labels claim a box. Higher priorities place first: hovered task, feature
  title and summary, Gizmo Prime, teams, busy agents, idle agents. A colliding
  or off-area label is skipped, never overlapped.
- Level of detail: team names from zoom 0.8, agent names from 1.2, task names
  only on hover.
- Canvas text carries a dark halo (`shadowBlur: 6`) to stay legible over glow.
- Floating text is reserved for failures, blockers and requeues; at most four at
  a time. Passed checks and commits use marks, not words.
- At most three attention callouts, filtered to the focused feature, kept inside
  the free area between the rails and above the dock and ticker.

## Layout

- The sky fills the window under the top bar. The left rail lists features, the
  right rail lists **Attention**, **Burning** and **Awaiting review**, and the
  dock holds replay controls and the activity histogram.
- The camera frames only the free area between the rails. Below 980px the rails
  and ticker hide and the dock stacks.
- The agent close-up keeps its event log inside the telemetry panel, which
  scrolls, so the two can never overlap.
- Agents report only to their coordinator, so close-up lasers reach Team Gizmo,
  Gizmo Prime or the host. Do not draw agent-to-agent links.

## Interaction

| Input                                   | Effect                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| Hover                                   | Lights the branch and its subtree, dims the rest, shows a tooltip. |
| Click a feature star or rail row        | Flies the camera to that feature; click again for the whole sky.   |
| Click an agent, a task or a **Now** row | Opens the agent close-up.                                          |
| Wheel / drag / double-click             | Zoom / pan / reset to the whole sky.                               |
| `Esc`                                   | Closes the close-up, otherwise returns to the whole sky.           |
| `←` `→`                                 | Previous or next agent in the close-up.                            |
| `Space` / `R`                           | Pause or play the replay / replay from the start.                  |
| Timeline                                | Drag to scrub; **LIVE** returns to the present.                    |

## Changing the sky

- **New flow state:** add a `GlyphKind`, its drawing, its legend entry and
  colour, then extend the fold and its tests.
- **New event kind:** add its cue in `SkyScene.cueEvent`, its ticker verb and
  tone in `SkyStage`, its focus link and caption, and a test.
- **New colour:** give it one meaning, add it to this document, and do not
  reuse red or gold for anything but attention and coordination.
- **New text on canvas:** route it through the label placement so it competes
  for room like everything else.
- Keep the repository's TypeScript rules: exhaustive `switch` instead of
  `if`/ternaries, one named request per method, enum states instead of booleans
  and absent values.
- Verify with `bun run verify` and `bun run test` from this directory.
