---
depth: standard
id: EPIC-003
kind: epic
status: active
title: Self-serve observability for product teams
---

# EPIC-003: Self-serve observability for product teams

## Vision

A non-SRE engineer at a customer organisation can sign up, integrate
the OTel SDK, and see their first dashboard within 15 minutes — no
ticket, no demo call, no manual provisioning.

## Strategic context

Helios's mid-market motion is constrained by sales-led onboarding
(2-week procurement, custom contract, manual user provisioning).
Self-serve unlocks product-led growth: free tier → paid tier without
sales involvement until enterprise scale.

## Children PRDs

| PRD | Title |
|-----|-------|
| PRD-007 | Usage-based billing meter |
| PRD-008 | Mobile dashboard companion app |

## Success Criteria

| ID | Criterion | Target |
|----|-----------|--------|
| EC-1 | Time-to-first-dashboard | sign-up → live dashboard | < 15 min |
| EC-2 | Activation rate | sign-ups completing OTel integration | ≥ 35% |
| EC-3 | PLG MRR | self-serve monthly recurring revenue | $40k by 2026-Q4 |
| EC-4 | NPS for self-serve | feature NPS | ≥ +25 |

## Components

- Sign-up flow (no sales touch) — owned by growth team, not in scope here
- Auto-provisioning via Tenant Operator (ADR-007)
- OAuth/SSO so customers can adopt enterprise IdP later (PRD-006)
- Usage meters for fair billing (PRD-007)
- Mobile companion (PRD-008) — table stakes for on-call workflow

## Compliance gating

EVID-011 surfaces SOC2 gaps that must close before enterprise tier
ships. Self-serve free + paid tiers can launch first; enterprise
gated on:
- C1.1 (data classification) closed
- P3.1 (privacy DSR workflow) closed

## Timeline

| Milestone | Target |
|-----------|--------|
| Free tier sign-up | 2026-Q3 |
| Self-serve paid tier | 2026-Q3 |
| Mobile GA | 2026-Q4 (gated on PROB-006 fix) |
| Enterprise tier | 2027-Q1 (gated on SOC2) |

## Related Artifacts

All children PRDs + relevant evidence.


