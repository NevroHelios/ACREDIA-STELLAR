# Credential TTL Keeper — Operations Runbook

**Issue**: [#281 — No funded, monitored TTL keeper](https://github.com/soumen0818/ACREDIA-STELLAR/issues/281)
**Last reviewed**: 2026-09-29

---

## Overview

Soroban persistent storage entries expire unless their TTL is extended.
`bump_credential` is permissionless and cheap when the TTL is already healthy
(only an extension is issued when the remaining TTL is below
`PERSISTENT_THRESHOLD`, approximately 6 months).

The TTL keeper cron (`/api/cron/ttl-keeper`) runs daily at **02:00 UTC**
(scheduled in `vercel.json`). It:

1. Reads all active (non-revoked) credential token IDs from the Supabase index.
2. Calls `bump_credential` on-chain for each, using the funded keeper account.
3. Records a structured run summary in `cron_run_log`.
4. Checks the keeper fee account balance and alerts if low.

The keeper's last run status is visible at `/api/admin/stats`
→ `stats.ttlKeeper`.

---

## Required configuration

| Environment variable | Description |
|---|---|
| `TTL_KEEPER_ACCOUNT_PUBLIC` | Stellar public key of the funded keeper account |
| `TTL_KEEPER_ACCOUNT_SECRET` | Stellar secret key of the keeper account (server-only) |
| `CRON_SECRET` | Shared secret authorizing cron invocations |

Set these in Vercel → Project → Settings → Environment Variables (Production).

**Keeper account funding**: the keeper account must hold enough XLM to cover
daily Soroban transaction fees. Each `bump_credential` call costs
approximately 0.00001 XLM (100 stroops) when the TTL is healthy and is a
no-op extend. Budget conservatively: 1 XLM covers ~100,000 no-op bumps.
Alert threshold is configured at **5 XLM** minimum balance.

---

## Monitoring

### Alert: missed run

The keeper runs at 02:00 UTC. If `stats.ttlKeeper.lastRunAt` is more than
25 hours old, the run was missed. Check:

1. Vercel → Deployments → Functions logs for `/api/cron/ttl-keeper`.
2. Whether `CRON_SECRET` is set correctly.
3. Whether the function timed out (Vercel Hobby: 60 s; Pro: 300 s).

### Alert: low keeper balance

`stats.ttlKeeper.lastRunSummary.lowBalance === true` means the keeper account
XLM balance is below `KEEPER_MIN_BALANCE_XLM` (5 XLM). Top up immediately.
The keeper will continue running on the next cycle but will eventually fail
if the balance reaches zero.

### Alert: bump failures

`stats.ttlKeeper.lastRunSummary.bumpFailed > 0` means some credentials failed
to bump. Check `lastRunSummary.failedTokenIds` for the affected token IDs and
investigate the on-chain state.

---

## Worst-case recovery: credential has already expired

> **Background**: A Soroban persistent entry that reaches TTL = 0 is archived
> (removed from the live state). It can be **restored** using
> `stellar contract restore` if the archive proof is available. This procedure
> must be rehearsed on testnet before mainnet launch.

### Step 1 — Confirm the credential is expired

```bash
# Attempt to verify the credential on-chain.
stellar contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  -- verify_credential \
  --token_id <TOKEN_ID>
# If it returns NotFound or similar, the entry may be expired/archived.
```

### Step 2 — Restore the archived entry

```bash
# Identify the storage key for the credential entry.
# The key is DataKey::Credential(token_id) in the contract's persistent storage.
stellar contract restore \
  --network testnet \
  --source <funded-account> \
  --id <CONTRACT_ID> \
  --key <STORAGE_KEY_XDR>
```

> **Note**: `stellar contract restore` requires the XDR encoding of the
> storage key. The key type is `DataKey::Credential(u64)` — derive its XDR
> from the contract's key schema or from the Stellar Lab contract explorer.

### Step 3 — Verify restoration

```bash
stellar contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  -- verify_credential \
  --token_id <TOKEN_ID>
# Should return the credential data.
```

### Step 4 — Bump to reset TTL

```bash
stellar contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  -- bump_credential \
  --token_id <TOKEN_ID>
# Extends TTL by PERSISTENT_BUMP_AMOUNT (~1 year).
```

### Step 5 — Confirm in Supabase

Verify the credential row in Supabase still exists and `revoked = false`.
The keeper's next run will maintain the TTL going forward.

---

## Rehearsal checklist (testnet)

Before mainnet launch, rehearse this entire procedure on testnet:

- [ ] Deploy contract to testnet, issue one credential.
- [ ] Advance ledger past `PERSISTENT_BUMP_AMOUNT` (or use testnet time skip).
- [ ] Confirm credential is archived (verify returns NotFound).
- [ ] Restore using `stellar contract restore`.
- [ ] Confirm verify returns credential data post-restore.
- [ ] Run TTL keeper cron manually — confirm bump extends TTL.
- [ ] Record the exact commands used, with timestamps, in the team's incident log.

---

## Reconciliation

The keeper reads the Supabase index, not the chain directly. An index gap
(credential on-chain but not in Supabase) would cause that credential to be
missed. Mitigation:

- `verify_credential` already falls back to reading the chain when the index
  has no row, so verification remains correct even if the index is incomplete.
- A future improvement: the keeper should cross-check by reading
  `total_credentials` from the chain and comparing against the Supabase count.
  A mismatch triggers an alert.

---

## docs/mainnet-readiness.md §3.3

See [mainnet-readiness.md](../mainnet-readiness.md) §3.3 for the current status
of this blocker.
