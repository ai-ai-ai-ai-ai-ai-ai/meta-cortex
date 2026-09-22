# Cloud-Native Operations

## Identify the target and current state

Before changing infrastructure, identify the intended project, account, region,
and resource. Read its current state through the project's supported provider
tooling. Review the proposed plan, diff, or equivalent change preview when the
tool supports one.

**Prohibited:** mutate whichever account happens to be active in the CLI.

**Preferred:** resolve the assigned account and resource, inspect their current
configuration, and verify the proposed change targets them.

## Protect operational credentials

Use narrowly scoped, short-lived identities where available. Keep credentials
in approved external secret storage, redact them from logs, and apply the
[shared secret lifecycle](../../../../../../security-team/docs/secret-lifecycle.md).
Use the consuming project's policy for rotation and revocation procedures.

**Prohibited:** place an administrator token in a committed manifest or command log.

**Preferred:** use the project's scoped identity and secret store, and verify
diagnostics do not expose credentials.

## Preserve a recovery path

Prefer a reversible, scoped mutation when it meets the required outcome. Know
which owner and supported rollback path can recover the resource before making
an impactful change.

**Prohibited:** replace unrelated resources to change one workload setting.

**Preferred:** limit the mutation to the assigned resource and identify its
supported recovery procedure before making the change.

## Verify live behavior

After the mutation, read live state and verify the
behavior or configuration required by the assignment. Check observed deployment
health as well as control-plane state; a resource marked ready does not alone
prove that its workload is serving correctly.

**Prohibited:** report a deployment healthy solely because the control plane marks it ready.

**Preferred:** inspect both the resulting configuration and the project's
required workload health checks, then report the observed result.
