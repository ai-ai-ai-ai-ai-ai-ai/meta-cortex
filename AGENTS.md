# Developing Meta-Cortex

Meta-Cortex develops itself using the framework in [framework/AGENTS.md](framework/AGENTS.md).
Read and follow that entry point with this repository as the project root and
`framework/` as the library root.

The distributable framework lives in `framework/`. The Rust package installs
that framework into consuming projects at `.meta-cortex/`. Keep framework
instructions generic and keep the root `LICENSE` in place.

Keep each practice with its subject: coding, security, or repository automation.
Common skills under `framework/skills/` are language independent and must not
depend on teams, agents, or specialized skills. Specialized skills extend
common practices; agent instructions select and compose skills for a task.
Keep one canonical copy of each practice and update all callers when moving it.

For installer changes, apply the framework's
[Rust skill](framework/agents/teams/dev-team/dev-agent/skills/rust-dev-skill/SKILL.md).
Run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and
`cargo test` before completing Rust changes.
