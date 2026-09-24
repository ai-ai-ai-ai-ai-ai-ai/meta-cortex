# Developing Meta-Cortex

Meta-Cortex develops itself using the framework in [cortex/AGENTS.md](cortex/AGENTS.md).
Read and follow that entry point with this repository as the project root and
`cortex/` as the library root.

The distributable framework lives in `cortex/`. The Rust executable installs
that framework into consuming projects at `.meta-cortex/`. Keep framework
instructions generic and keep the root `LICENSE` in place.

Keep each practice with its subject: programming, security, or repository automation.
Put shared subject knowledge in the owning team’s `docs/`, with an
`index.md` navigation catalog containing only links and brief topic summaries.
Keep rules, explanations, and examples in descriptively named documents.
Teams live in `cortex/teams/`; each team groups its agents under `agents/`.
Both Gizmo coordinators belong to `gizmo-team`.
Skills live under their owning agents. Do not create library-root or team-level
skill directories. Each agent links its skills; each `SKILL.md` owns its instructions.
Keep one canonical copy of each practice and update all callers when moving it.

The Rust workspace lives in `app/`. `app/installer/` owns the `meta-cortex`
executable, command transport, and framework installation. `app/workbench/`
owns durable agent coordination, Turso storage, migrations, and domain tests.
Keep database code and dependencies in workbench; installer uses its public API.
Shared Cargo dependencies, lint policy, lockfile, and release profile live at the
workspace root. The framework remains at the repository root in `cortex/`.

For Effect code, use the official
[Effect skills](https://github.com/Effect-TS/skills). Before editing, read
`cortex/node_modules/effect/AGENTS.md` completely and follow its relevant links;
consult `cortex/node_modules/effect/src` for API details. The Bun workspace in
`cortex/` supplies this installed v4 package and its version-matched guidance.

For Rust changes, apply the framework's
[Rust skill](cortex/teams/dev-team/agents/rust-dev/skills/rust-dev-skill/SKILL.md).
From `app/`, run `cargo fmt --all --check`, `cargo check --locked --workspace --all-targets`,
`cargo clippy --locked --workspace --all-targets -- -D warnings`, and
`cargo test --locked --workspace` before completing Rust changes. Measure combined
coverage with `cargo llvm-cov --locked --workspace --fail-under-lines 90`.

## Current interface

This project does not retain legacy CLI aliases, interactive setup paths, or
old instruction formats for hypothetical compatibility. `list` discovers commands;
`run` executes typed YAML requests, including framework initialization and inspection.
Remove superseded paths and update their callers, tests, and documentation together.
Keep the explicitly required Workbench schema-version and migration support;
add other compatibility mechanisms only for a demonstrated supported contract.
