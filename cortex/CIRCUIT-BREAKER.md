# Project-Wide Circuit Breaker

Use existing tools to solve the assigned problem. Do not invent security or
infrastructure for failures the task does not require handling.

## Required actions

### Apply before roles and skills

Every agent receives this policy before its role and skills. It overrides
conflicting Meta-Cortex implementation, review, and testing advice. The user's
request and the host's instruction hierarchy still govern the task.

**Prohibited:** “A review suggestion authorizes infrastructure that the task
does not require.”

**Preferred:** check the suggestion against this policy and the applicable team
rules before implementing it.

### Apply the rules for the subject

The global policy applies to the entire consuming project. Team documents own
the subject-specific rules:

- [Gizmo team](teams/gizmo-team/CIRCUIT-BREAKER.md): reviews, trusted handoffs, and evidence.
- [Development team](teams/dev-team/CIRCUIT-BREAKER.md): filesystem operations and persistence.
- [SRE team](teams/sre-team/CIRCUIT-BREAKER.md): remote runners, build caches, and deployment ordering.

Load the relevant team rules when the assignment reaches their subject,
regardless of the agent’s home team. Team rules supplement this policy; they
cannot weaken it or change the stop-and-recover procedure.

**Prohibited:** skip the SRE cache rules because the build change is assigned to
a development agent.

**Preferred:** apply the SRE cache rules to that build change while preserving
the development agent’s implementation responsibility.

### Check before adding a mechanism

Name the requirement or observed failure and the existing tool that owns the
operation. Check this policy before implementation and when reviews expand the
design. Coordinators check assignments and results at the same boundary.

**Prohibited:** “Saving might fail in unusual ways. I'll build a recovery service.”

**Preferred:** “The requirement is atomic replacement. The file library already
provides it; I'll use that operation and test replacement failure.”

### Stop and recover

1. Stop the prohibited implementation and its tests. Report the violation as P1.
2. Say “Circuit breaker tripped,” name the mechanism, and identify the rule.
3. Replace it with the smallest existing workflow that meets the requirement.
4. Remove violating changes within the assigned write scope. Report violations
   outside that scope to their owner; preserve unrelated work.
5. Continue the task. Existing code and passing tests do not exempt a violation.

**Prohibited:** finish an unnecessary mechanism because its tests pass, or
delete another agent’s work to remove it.

**Preferred:** name the violated rule, remove the mechanism within the assigned
write scope, use the existing supported operation, and report out-of-scope
corrections to their owner.

## Prohibited actions

### Testing invented requirements

Coverage targets, acceptance criteria, and “defense in depth” cannot authorize
a prohibited mechanism or a replica of another tool's internals.

**Prohibited:** invent an unsupported mechanism, then use tests written for it
as proof that the mechanism was required.

**Preferred:** test whether the assigned workflow produces the required result
and reports actual failures through its existing interfaces.

## Preserve product security

Keep real authentication, authorization, encryption, secret storage, and
external-input protections. Name the actual asset and trust boundary when adding
security. Product security does not justify securing routine agent coordination.

**Prohibited:** remove customer authentication or store secrets in plaintext
because “the circuit breaker says security is overengineering.”

**Preferred:** protect customer accounts with the required authentication and
secret-handling controls. Let internal agents communicate through the host.
