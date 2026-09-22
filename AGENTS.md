# Developing Meta-Cortex

Meta-Cortex develops itself using the framework in [cortex/AGENTS.md](cortex/AGENTS.md).
Read and follow that entry point with this repository as the project root and
`cortex/` as the library root.

The distributable framework lives in `cortex/`. The Rust package installs
that framework into consuming projects at `.meta-cortex/`. Keep framework
instructions generic and keep the root `LICENSE` in place.

Keep each practice with its subject: coding, security, or repository automation.
Skills live under their owning agents. Do not create library-root or team-level
skill directories. Each agent’s instructions define its skills and prerequisites.
Keep one canonical copy of each practice and update all callers when moving it.

For installer changes, apply the framework's
[Rust skill](cortex/agents/teams/dev-team/rust-dev/skills/rust-dev-skill/SKILL.md).
From `installer/`, run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and
`cargo test` before completing Rust changes.
