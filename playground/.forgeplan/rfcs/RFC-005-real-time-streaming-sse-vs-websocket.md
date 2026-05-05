---
depth: standard
id: RFC-005
kind: rfc
links:
- target: PRD-008
  relation: refines
- target: RFC-010
  relation: supersedes
status: superseded
title: 'Real-time streaming: SSE vs WebSocket'
---

# RFC-005: Real-time streaming — SSE vs WebSocket

## Summary

Streaming endpoints (live alerts, query subscriptions, log tail)
use Server-Sent Events (SSE) over HTTP/2, not WebSocket. Bidirectional
control (subscription start/stop) is via separate REST POST.

## Motivation

We need streaming to push live updates to dashboards. WebSocket is
the obvious choice but has tradeoffs: connection management, proxy
issues, no built-in reconnect, no native HTTP/2 multiplexing.

## Goals

- Push updates to dashboards within 1s of event
- Support 10k concurrent streams per region without dedicated WS layer
- Survive intermediate proxy hostility (corporate firewalls)

## Comparison

| Property | SSE | WebSocket |
|----------|-----|-----------|
| Direction | Server → Client | Bidirectional |
| Built-in reconnect | Yes (Last-Event-ID) | No (manual) |
| Multiplex over HTTP/2 | Yes | No (separate connection) |
| Proxy compat | High (regular HTTP) | Mixed |
| Browser support | Universal | Universal |
| Backpressure | HTTP-native | Application-managed |

## Decision

SSE for server→client push. POST endpoint for control (start/stop a
subscription). This avoids WebSocket-specific infra (sticky LB,
upgrade-aware proxies) and gets HTTP/2 multiplexing for free.

## Risks

- R-1: SSE has 6-stream-per-origin limit in HTTP/1.1. Mitigation:
  HTTP/2 enforced at edge.
- R-2: Some load balancers buffer responses, breaking SSE. Mitigation:
  documented configurations; staging tests in matrix.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-008 | refines |



