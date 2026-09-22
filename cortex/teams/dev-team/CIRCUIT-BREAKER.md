# Programming Circuit Breaker

Apply these subject-specific rules alongside the global circuit-breaker policy
already supplied with the assignment. Use its stop-and-recover procedure when
a rule is violated. These rules apply to the subject, including work or review
by an agent from another team.

## Rebuilding filesystem infrastructure

Use standard or maintained library operations for writes, locking, and
persistence. Add machinery only for an explicit requirement or observed failure.

**Prohibited:** implement a journal, lease service, crash-recovery protocol, and
fault simulator to save one configuration file.

**Preferred:** use a library's atomic replacement operation when required.
Preserve required content and permissions. If crash durability is explicitly
required, use supported durability operations and test that requirement.
