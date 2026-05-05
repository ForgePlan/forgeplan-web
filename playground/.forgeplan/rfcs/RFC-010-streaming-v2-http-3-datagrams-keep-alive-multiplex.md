---
depth: standard
id: RFC-010
kind: rfc
status: active
title: 'Streaming v2: HTTP/3 datagrams + keep-alive multiplex'
---

# RFC-010: Streaming v2 — HTTP/3 datagrams + keep-alive multiplex

## Summary

Supersedes RFC-005 (SSE vs WebSocket). Supersession rationale:
HTTP/3 has shipped widely enough (>78% of customer browsers per
EVID-009 update) to make HTTP/3 datagrams + WebTransport viable as
a streaming primitive that beats SSE at scale.

## Motivation

- SSE has 6-stream-per-origin limit on HTTP/1.1 (no longer relevant
  on HTTP/2+, but corporate proxies still downgrade)
- HTTP/3 datagrams (RFC 9221) provide unreliable, low-latency push
  ideal for live alert preview
- Single QUIC connection multiplexes all streams; no connection
  amplification at the LB

## Goals

- Live alert preview latency p95 < 200ms (currently 1.2s on SSE)
- Single connection per browser tab (down from 4 SSE connections)
- Graceful fallback to SSE for HTTP/2-only clients

## Decision

- HTTP/3 datagrams for unreliable push (live alert preview)
- WebTransport bidirectional streams for reliable push (query subs)
- SSE retained as fallback for older clients (sniffed via ALPN)

## Risks

- HTTP/3 deployment in customer corporate networks varies; fallback
  path stays load-bearing for years
- WebTransport API stability still in flux on older browser versions

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-005 | supersedes |
| PRD-008 | refines |


