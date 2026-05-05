---
depth: standard
id: PRD-006
kind: prd
links:
- target: EPIC-002
  relation: refines
status: active
title: OAuth2 and SSO integration
---

# PRD-006: OAuth2 and SSO integration

## Executive Summary

### Vision

Enterprise customers authenticate against their existing IdP (Okta,
Auth0, Google Workspace, Azure AD) without manual user provisioning;
Helios auto-provisions on first login with claim-based RBAC.

### Problem

Manual user management blocks enterprise sales: every new engineer
needs an admin to add them. Two prospect deals stalled in 2026-Q1
on "we won't deploy if every onboarding is a ticket".

### Target Users

| Persona | Description | Pain |
|---------|-------------|------|
| Customer admin | Manages access | Manual adds, manual removes |
| Engineer | Daily user | Onboarding gate |

## Success Criteria

| ID | Criterion | Metric | Target |
|----|-----------|--------|--------|
| SC-1 | Onboarding latency | first IdP click → logged in | < 60s |
| SC-2 | IdP coverage | Okta, Auth0, Google WS, Azure AD | 4/4 |
| SC-3 | Auth security | failed pen-test high findings | 0 |

## Functional Requirements

| ID | Category | Priority | Requirement |
|----|----------|----------|-------------|
| FR-001 | Auth | Must | Tenant admin can configure OAuth2/OIDC IdP via metadata URL |
| FR-002 | Provisioning | Must | System can auto-provision user on first IdP login |
| FR-003 | RBAC | Must | System can map IdP claims to Helios roles via configurable rules |
| FR-004 | Lifecycle | Should | System can deactivate users on IdP-side group removal (SCIM) |

## Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Security | OAuth flow audited; 0 high findings |
| NFR-002 | Reliability | IdP outage falls back to local-emergency-admin only |
| NFR-003 | Compatibility | Works on Safari iOS 17+ (PROB-006 to fix) |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-002 | parent |
| SPEC-007 | Auth token refresh flow |
| EVID-010 | Pen test (PRD acted on findings) |
| PROB-006 | OAuth Safari iOS 17 |


