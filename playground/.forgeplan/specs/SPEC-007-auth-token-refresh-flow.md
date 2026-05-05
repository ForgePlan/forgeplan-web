---
depth: standard
id: SPEC-007
kind: spec
links:
- target: PRD-006
  relation: refines
status: active
title: Auth token refresh flow
---

# SPEC-007: Auth token refresh flow

## Token types

| Token | Lifetime | Use |
|-------|----------|-----|
| Access token (JWT, RS256) | 15 min | API requests |
| Refresh token (opaque, 32 bytes) | 30 days, sliding | Get new access token |
| Session cookie (signed) | Browser session | Dashboard SPA |

## Initial issue (after IdP redirect)

```
1. User clicks "Sign in" → redirect to IdP
2. IdP returns to /auth/callback with authorization_code
3. Exchange code for IdP tokens (Authorization Code with PKCE)
4. Helios validates id_token, looks up / provisions user
5. Helios issues access_token + refresh_token
6. Browser receives session cookie; mobile receives both tokens
```

## Refresh flow

```
POST /auth/refresh
Content-Type: application/json

{ "refresh_token": "rt_..." }
```

Response (200):

```json
{
  "access_token":  "eyJhbGc...",
  "refresh_token": "rt_...",
  "expires_in":    900
}
```

- Refresh token is **rotated** on every use (one-time use; old token
  revoked atomically)
- Refresh sliding window: each use extends 30 days from now
- Re-use of an already-used refresh token → revoke entire token family
  (compromise indicator); user must re-authenticate

## Revocation

- `POST /auth/revoke` invalidates a specific refresh token
- Logout invalidates session cookie + revokes the active refresh token
- Admin "force logout" invalidates all tokens for a user atomically

## Storage

- Refresh tokens stored hashed (SHA-256) in Postgres; raw token never
  retained server-side after issue
- Access tokens are stateless JWTs (no DB roundtrip)
- Revocation uses a low-TTL deny list (30 min) to handle in-flight
  access tokens after revoke

## Mobile / Safari iOS 17 considerations

PROB-006: Safari iOS 17 enforces stricter cross-origin handling
during the OAuth callback. Mitigation:

- `redirect_uri` must use the production domain (no localhost shims)
- `Set-Cookie` must include `SameSite=Lax`
- After refresh, set new cookie via 302 redirect (in-document, not via
  fetch), to satisfy iOS cookie partitioning rules

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-006 | refines |
| EVID-010 | informs (pen test findings on token reflection) |


