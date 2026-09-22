# SRE Knowledge

The consuming project owns its execution commands, CI workflows, infrastructure,
and deployment and release procedures. Meta-Cortex supplies operational
expertise without selecting a build system or defining a release pipeline.

## Required actions

### Discover the project's execution contract

1. Read the project's `AGENTS.md` and linked CI or operations documentation.
2. Inspect the relevant workflow and command definitions. Follow the documented
   entry point whether it uses Taskfile, Makefile, Justfile, package scripts,
   another tool, or a direct workflow dispatch.
3. Resolve the requested check, working directory, inputs, execution environment,
   workflow trigger, and expected result. Inspect downstream jobs before running
   a selector that may also deploy or publish.
4. Preserve project rules on local versus hosted execution and required versus
   advisory checks. Documentation and actual workflow disagreements are a
   blocker for the affected operation, not permission to choose the easier path.
5. Reuse decisions already established in project or session context. Ask only
   about missing choices that prevent the requested operation.

A command file's presence does not establish which target is authoritative.
Use the project's existing documentation rather than creating a second command
registry, universal runner adapter, or mandatory configuration file.

**Prohibited:** discover a Makefile and assume `make test` is the merge gate, or
replace a project's Justfile with Taskfile to match another repository.

**Preferred:** follow the project instructions to its documented validation
entry point and inspect the existing workflow that executes it.

### Keep deployment policy project-owned

A deployment or release request identifies the existing project procedure,
source revision or artifact, target environment, and authorized operation.
These facts belong in the consuming project's documentation and workflows.
Meta-Cortex does not prescribe versioning, release branches, artifact promotion,
providers, or rollout strategy. A missing release procedure is a blocker to
execution, not authorization to generate one during routine delivery.

**Prohibited:** translate a request to merge a PR into a production deployment
or create a generic release workflow inside the framework.

**Preferred:** when asked to deploy, use the project's existing procedure and
report its run, deployed revision or artifact, and verification outcome.
