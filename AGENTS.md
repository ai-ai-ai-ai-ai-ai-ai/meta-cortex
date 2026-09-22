# Developing Meta-Cortex

Meta-Cortex develops itself using the framework in [cortex/AGENTS.md](cortex/AGENTS.md).
Read and follow that entry point with this repository as the project root and
`cortex/` as the library root.

The distributable framework lives in `cortex/`. The Rust package installs
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

For installer changes, apply the framework's
[Rust skill](cortex/teams/dev-team/agents/rust-dev/skills/rust-dev-skill/SKILL.md).
From `installer/`, run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and
`cargo test` before completing Rust changes.
