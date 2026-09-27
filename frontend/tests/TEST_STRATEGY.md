# Test Strategy: Core Academic Credential Lifecycle

This document describes the testing strategy and structural patterns utilized for validating the end-to-end credential lifecycle in **ACREDIA-STELLAR**.

---

## 🏗️ Core Design Pattern

Academic credential operations rely heavily on decentralized components (Stellar Soroban smart contracts, IPFS storage networks) and modern database APIs (Supabase). To ensure stable, local, and CI-compatible testing without hitting live blockchain node environments or third-party networks, we implement **fully mocked integration / E2E tests**.

```
┌────────────────────────────────────────────────────────┐
│               tests/e2e.lifecycle.test.ts              │
└───────────────────────────┬────────────────────────────┘
                            ▼ Mocks (using Vitest)
 ┌─────────────────┬─────────────────┬─────────────────┐
 │   IPFS Service  │  Stellar Network│  Supabase Client│
 └─────────────────┴─────────────────┴─────────────────┘
```

---

## 🧪 Verified Testing Scenarios

Located in [e2e.lifecycle.test.ts](./e2e.lifecycle.test.ts):

### 1. Successful Credential Issuance Lifecycle

- **Strategy**: Mock IPFS file and metadata storage, simulate a successful transaction sign and broadcast on the Stellar network (obtaining a valid token ID), and assert that the Supabase client inserts the exact metadata payload, mapping the token correctly.

### 2. Failed Wallet Signing (Freighter Rejection)

- **Strategy**: Configure Freighter signature simulators to throw rejected/canceled errors, verifying that the service fails gracefully, bubbles up transaction sign failures, and does **not** insert stray records into Supabase.

### 3. Verification Success States

- **Strategy**: Query the `/api/verify/[token]` handler with a mock request. Verify that the system dynamically calculates the stored schema version's credential metadata hash, checks it against the simulated on-chain registry, and returns `verification.verified: true`.

### 4. Verification Revoked States

- **Strategy**: Request validation of an issued credential where the on-chain Soroban query yields `isRevoked: true`. Verify that the route responds with `revoked: true` and `verification.verified: false` instantly.

### 5. Verification Not Found States

- **Strategy**: Query the verification API endpoint with an invalid or non-existent token ID. Verify that the response status is 404, with a descriptive "Credential not found" error payload.

### 6. Verification Mismatch States

- **Strategy**: Query verification for a token where the metadata stored in Supabase doesn't match the on-chain registered state (e.g. modified SHA-256 hash or altered wallet addresses). Assert that `verification.verified` resolves to `false`, public responses avoid granular mismatch internals, and the private audit log stores coarse mismatch reason codes.

### 7. Role-Based Access Validation

- **Strategy**: Validate route access patterns using mocked authentication states. Verify that the admin authorization guard helper (`requireAdminRequest`) resolves correctly for allowlisted admin emails and successfully denies student or unauthorized access roles.

---

## 🛡️ Base-URL Identity Guard

**If a browser run fails before any test starts, with "Refusing to run the Playwright
suite against …", this is the section you want.**

### What it does

[global-setup.ts](./playwright/global-setup.ts) runs once, before any spec, and fetches
the configured base URL. It continues only if the response carries the Acredia marker —
a `<meta name="x-acredia-app" content="acredia-stellar">` tag emitted from the root
layout, so it is present on every route. Anything else aborts the run with an explicit
message naming the URL and how to fix it.

### Why it exists

`webServer.reuseExistingServer` attaches to whatever is already listening on the
configured port. Port 3000 is shared with roughly every other web project on a
developer's machine, and on 2026-09-26 the a11y suite attached to an unrelated CRM dev
server and reported four failures citing elements (`/objects/people`,
`navigation-drawer-item`) that exist nowhere in this repository (ACREDIA-STELLAR#271).

The false failures were the visible harm; the false *passes* were the real one. Another
app that happens to be accessible on the audited paths would report green while
Acredia's own regressions shipped unexercised — and nothing in the output would say the
audit had been pointed somewhere else.

### The three layers

| Layer | Mechanism | Covers |
| --- | --- | --- |
| Unlikely collision | Default port is **3199**, not 3000 | The everyday case |
| Detected collision | Global setup asserts the marker | A collision that happens anyway |
| No collision at all | `reuseExistingServer: !process.env.CI` | CI, which always starts its own server |

### Overriding the port

`PLAYWRIGHT_PORT` still works when 3199 is itself taken:

```bash
PLAYWRIGHT_PORT=3200 npx playwright test
```

### Changing the marker

The name and value live in [src/lib/appIdentity.ts](../src/lib/appIdentity.ts) and are
compared as strings. Changing one side alone breaks every browser run — the layout and
the guard must move together. [playwrightIdentityGuard.test.ts](./playwrightIdentityGuard.test.ts)
covers both, including a deliberate run against a non-Acredia responder that asserts the
setup fails rather than proceeding.
