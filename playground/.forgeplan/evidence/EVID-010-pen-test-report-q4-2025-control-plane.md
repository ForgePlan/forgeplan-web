---
depth: tactical
id: EVID-010
kind: evidence
links:
- target: PRD-006
  relation: informs
status: active
title: 'Pen test report Q4 2025: control plane'
---

# EVID-010: Pen test report Q4 2025 — control plane

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2025-12-18 |
| Valid Until | 2026-12-18 |
| Target | PRD-006 (OAuth2 + SSO integration) |
| Author | external — Trail of Bits |
| Engagement | 2 weeks, 2 senior testers |

## Structured Fields

evidence_type: audit
verdict: weakens
congruence_level: 3

## Scope

- Control plane API (`api.helios.io`)
- Tenant provisioning state machine
- OAuth2 / OIDC integration with Auth0, Okta, Google Workspace
- Webhook dispatch (signing + replay protection)

Excluded: data plane, browser SPA, mobile, third-party SDKs.

## Findings summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 5 |
| Low | 8 |
| Info | 14 |

## High-severity findings

**H-1: Token reflection in OAuth state parameter**
The `state` round-tripped during OAuth authz allows reflection of
attacker-controlled JSON when a tenant is configured with a relaxed
`redirect_uri` regex. Exploitable end-to-end as session fixation on
shared workstations.

*Status*: fixed 2026-01-08, verified 2026-01-12.

**H-2: Webhook signing key entropy on legacy tenants**
~140 tenants provisioned before 2024-Q3 have webhook signing keys
derived from a deterministic seed. Adversary with leaked tenant ID
can forge webhook deliveries.

*Status*: rotation in progress; new keys 256-bit random; legacy keys
deprecated 2026-04-30.

## Recommendations not yet acted on

- M-3: Rate-limit failed login per-user (currently per-IP only)
- M-5: Bind sessions to TLS exporter for hardened cookies
- L-2: Strict-Transport-Security max-age below recommendation

## Interpretation

Control-plane posture is acceptable post-H-1 fix. OAuth integration
(PRD-006) needs to land H-2 rotation before SOC2 audit (EVID-011).

## Congruence Level Justification

CL3: black-box + grey-box test against actual production parity
environment with real auth integrations.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-006 | informs (auth gaps must close) |
| EVID-011 | informs (compliance dependency) |


