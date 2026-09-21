# Cloud-Native Operations

Before changing infrastructure, identify the intended project, account, region,
and resource, then read its current state through the project's supported
provider tooling. Review the proposed plan, diff, or equivalent change preview
when the tool supports one. Use narrowly scoped, short-lived identities where
available. Keep credentials in approved external secret storage, redact them
from logs, and follow the selected secret-lifecycle practice for rotation and
revocation.

Prefer a reversible, scoped mutation when it meets the required outcome. Know
which owner and supported rollback path can recover the resource before making
an impactful change. After the mutation, read live state and verify the
behavior or configuration required by the assignment. Check observed deployment
health as well as control-plane state; a resource marked ready does not alone
prove that its workload is serving correctly.
