# AcrediaCredential Contract — Security Audit

**Contract**: `AcrediaCredential` (`contracts/src/lib.rs`)
**Scope**: `contracts/src/lib.rs`, `contracts/Cargo.toml`
**Type**: Internal manual security review (source-level, plus `cargo clippy` and `cargo audit`)
**Status**: Findings below are resolved or explicitly accepted/tracked as noted per-finding.

> This document records an **internal** review. It is groundwork for, and does not replace,
> the independent third-party audit required before mainnet deployment — see
> [MAINNET_CHECKLIST.md](./MAINNET_CHECKLIST.md), item 1. Share this report and the checklist
> with the external auditor as a starting point; re-open any finding here that they dispute or
> want to dig into further.

## Methodology

- Full manual read-through of every public entrypoint in `AcrediaCredential`, focused on:
  access control (who can call what, and how that is enforced), state transitions and their
  invariants, storage/TTL handling, integer arithmetic, and event coverage.
- `cargo clippy --all-targets` — no lints on production code (3 pre-existing style warnings in
  test helper code only, unrelated to correctness or security).
- `cargo audit` against the dependency tree (193 crates) — no known-vulnerable (RUSTSEC) crates
  in use; see F-9.
- New tests written to encode the trust model as executable checks: explicit owner/pending-owner
  auth-gating tests for every privileged entrypoint, and a proptest-based invariant test that
  drives randomized sequences of issuance/revocation and checks core invariants after every step
  (`mod proptest_invariants` in `src/lib.rs`).

## Findings

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| F-1 | Medium | `initialize()` had no authorization check | **Fixed** |
| F-2 | Low | `upgrade()` emitted no event | **Fixed** |
| F-3 | Low | `migrate()` emitted no event | **Fixed** |
| F-4 | Info | `initialize()` emitted no event | **Fixed** |
| F-5 | Medium | No owner override for `revoke_credential` | **Accepted / tracked** |
| F-6 | Low | `revoke_issuer` on a never-authorized address is a silent no-op that still emits `iss_rev` | **Accepted / tracked** |
| F-7 | Info | No length cap on `ipfs_uri` | **Fixed** |
| F-8 | Info | `read_owner()` uses `.unwrap()`, relying on an invariant rather than a typed error | **Accepted (safe today)** |
| F-9 | Info | Dependency hygiene (`cargo audit`) | **Informational** |
| F-10 | Info | Re-entrancy | **Reviewed, not applicable** |

---

### F-1 (Medium) — `initialize()` had no authorization check

**Before**: `initialize(owner: Address)` set `owner` from the caller-supplied argument with no
`require_auth()` call at all. Anyone could call `initialize` on a freshly deployed,
not-yet-initialized contract and set *any* address as owner — including an address the caller
does not control (e.g. a typo'd address or a burn address), which would permanently brick the
contract's admin functions, since `Owner` is otherwise immutable outside of an
owner-authorized `transfer_owner`/`accept_owner` flow.

**Fix**: `initialize()` now calls `owner.require_auth()` before writing state
([lib.rs](./src/lib.rs), `initialize`). This closes the "set an address I don't control"
bricking variant, because the caller must now produce a valid signature for whatever address
they pass as `owner`.

**Residual risk (not fully closed by this fix)**: an attacker who front-runs the legitimate
deploy transaction can still call `initialize(their_own_address)` and become the owner
themselves, since they can always sign for their own address. The contract alone cannot prevent
this without changing to an atomic constructor-at-deploy pattern (out of scope for this pass —
see the note in `MAINNET_CHECKLIST.md`). **Operational mitigation, required at mainnet**: submit
the deploy and `initialize` calls as a single atomic transaction (or in immediate succession
from the same trusted operator flow), and treat any `init` event observed from an address you
did not submit as a compromised deployment requiring redeploy before any credentials are issued.

**Test coverage**: `test_initialize_requires_owner_auth`.

### F-2 / F-3 / F-4 — Missing events on `upgrade`, `migrate`, `initialize`

`upgrade()` (WASM code replacement) and `migrate()` (schema migration) are the two highest-impact
owner actions in the contract, yet neither emitted an event; `initialize()` didn't either.
Off-chain indexers/monitoring had no reliable on-chain signal for "the contract's code just
changed" or "the contract just came into existence." Fixed by adding `init`, `upgraded`
(topic + new WASM hash), and `migrated` (topics: `migrated`, previous version; data: new version)
events. Covered by `test_initialize_event`, `test_upgrade_event`, `test_migrate_event`.

### F-5 (Medium) — No owner override for `revoke_credential`

`revoke_credential` checks `credential.issuer == issuer` and nothing else — only the exact
address that originally issued a credential can revoke it, even after that issuer has since been
deauthorized via `revoke_issuer`. If an issuer's signing key is compromised or lost, the contract
owner can stop that issuer from minting *new* credentials, but has no path to revoke a
*specific bad credential* already issued by them.

**Decision**: left as-is in this pass. This is a real trust-model tradeoff, not an oversight —
adding an owner override changes who can invalidate an institution's attestations, which is a
product/governance decision, not a pure security fix. **Recommendation**: decide before mainnet
whether an owner-gated `admin_revoke_credential(token_id)` escape hatch is wanted for
compromised-issuer incident response, and if so, add it with its own explicit tests and an
event distinct from `cred_rev` (so verifiers can tell "the issuer revoked this" from "the
platform revoked this over the issuer's head"). Tracked in `MAINNET_CHECKLIST.md`.

### F-6 (Low) — `revoke_issuer` no-op on a never-authorized address still emits `iss_rev`

Calling `revoke_issuer(x)` for an `x` that was never authorized is a harmless no-op (removing a
nonexistent storage key is safe in Soroban), but it still publishes an `iss_rev` event, which
could mislead an off-chain indexer into believing `x` was previously authorized. Left as-is:
fixing it changes observable event semantics for any existing integrator watching `iss_rev`
(from "always fires on revoke_issuer" to "only fires if something changed"), which is a
behavioral change that should be a deliberate decision alongside F-5, not a drive-by fix.

### F-7 (Info) — No length cap on `ipfs_uri` — **Fixed**

**Before**: `issue_credential` and `batch_issue_credential` accepted an unbounded `String` for
`ipfs_uri`, while `IssuerProfile` already capped its own fields (`MAX_ISSUER_NAME_LEN`,
`MAX_ISSUER_PROFILE_URI_LEN`) for exactly the reason that applies here — "keep per-issuer
storage/TTL cost small." The same reasoning was simply not applied to credentials.

**Why the original "accepted" call was revised**: this pass first argued the cost was
self-inflicted, since an issuer pays their own fees. That holds for an honest issuer, but it
is the wrong bound. A credential is a *permanent* persistent entry whose size is paid for
again on every TTL extension, for the life of the contract — so the cost outlives the
transaction that caused it. More importantly, "requires an authorized issuer" is not a strong
constraint: a compromised issuer key is precisely the scenario F-1's residual-risk note and
F-5 already contemplate, and in that scenario the attacker has no reason to care about fees.
Pushing the cap to the frontend also does not work, because the frontend is not the only thing
that can call a public contract entrypoint — a cap that only exists off-chain is not a cap.

**Fix**: added `MAX_IPFS_URI_LEN` (256 bytes, with the sizing rationale documented at the
constant in [lib.rs](./src/lib.rs)) and a dedicated `UriTooLarge` error, enforced in both
`issue_credential` and `batch_issue_credential`. 256 is the same value as
`MAX_ISSUER_PROFILE_URI_LEN` — both fields hold the same kind of value — and leaves roughly 4x
headroom over the 66-byte `ipfs://<CIDv1>` URIs this contract actually issues.

Two deliberate choices in the fix:

- **A new error code, not a reuse of `ProfileTooLarge`.** `UriTooLarge` is appended as code
  `14`, so codes 1–13 keep their on-chain meaning and the change is ABI-additive. A caller can
  now distinguish "your issuer profile is too big" from "this credential's URI is too big"
  without inferring it from which entrypoint it called.
- **Per-row rejection in the batch path, not a whole-call `Err`.** `batch_issue_credential`'s
  documented contract is that one bad row does not discard the rest of the batch, so an
  oversized URI is reported as a failed `BatchIssueResult` exactly as a duplicate hash is. The
  check runs *before* the duplicate lookup, so a rejected row neither reserves its hash nor
  consumes a token id.

**Compatibility**: this is a behavioural change to a deployed contract. Confirmed safe to
deploy before doing so — the testnet instance
(`CARWFW27MJ3OJADAUAHI3TDFHIL62YMLVEKTUTMSNXOMH7JJTNZKC3DK`) reports `total_credentials == 0`
and returns `CredentialNotFound` for probed token ids, so no existing credential exceeds the
cap and none is made un-reissuable. Re-run that check against any other live instance before
deploying there. Reads are unaffected either way: the cap is enforced only on write paths, so
an over-cap entry written by an older build would still be retrievable. Note the asymmetry for
any future revision — raising the cap is backward-compatible, lowering it is not.

**Test coverage**: `test_issue_credential_at_max_uri_len_succeeds`,
`test_issue_credential_rejects_oversized_uri`, `test_batch_issue_at_max_uri_len_succeeds`,
`test_batch_issue_rejects_oversized_uri_per_row` — each entrypoint tested at exactly the cap
and one byte over, with the over-cap cases also asserting that nothing was written (counter
unmoved, hash still free) and that the failure is a typed error rather than a panic.

### F-8 (Info) — `read_owner()` relies on an invariant instead of a typed error

```rust
fn read_owner(env: &Env) -> Address {
    require_initialized(env);
    env.storage().instance().get(&DataKey::Owner).unwrap()
}
```

Safe today because `initialize()` is the only place `Initialized` and `Owner` are ever set, and
it sets both together. Flagged as a latent footgun for future refactors that might decouple the
two. Not changed here: `read_owner` returns a bare `Address` and is called from non-`Result`
functions (`authorize_issuer`, `revoke_issuer`, `upgrade`); converting it to return
`Result<Address, ContractError>` would ripple into those functions' on-chain signatures, which
is a larger, deliberate ABI change out of proportion to the actual risk.

### F-9 (Info) — Dependency hygiene

`cargo audit` (1173 advisories, 193 crates scanned) reports no CVE-level vulnerabilities.
Two informational warnings, both transitive and not exploitable in this contract:

- `paste 1.0.15` — unmaintained (RUSTSEC-2024-0436).
- `spin 0.9.8` — yanked version.

**Recommendation**: add `cargo audit` to CI (see `MAINNET_CHECKLIST.md`) so newly-disclosed
advisories are caught automatically rather than at ad hoc review time.

### F-10 (Info) — Re-entrancy — reviewed, not applicable

The contract makes no cross-contract calls other than `env.deployer().update_current_contract_wasm`
during `upgrade` (owner-gated, no user-controlled callback). Soroban's storage/host model does not
expose the classic EVM-style re-entrancy surface here. No action needed.

## Positive findings (things reviewed and found sound)

- **Owner-gating architecture**: privileged entrypoints call `.require_auth()` on the address
  *read from contract storage* (`read_owner(&env)`), never on a caller-supplied "admin" argument.
  This rules out a common class of bug where a naive `caller == admin` check can be bypassed by
  simply passing a different `caller` argument.
- **Two-step ownership transfer** (`transfer_owner` / `accept_owner`) prevents an irreversible
  mistake from a single mistyped address.
- **TTL/archival handling**: every write and read path extends TTL on the affected entries
  (`extend_credential_ttl`, `extend_instance_ttl`, `extend_total_credentials_ttl`), and this is
  now covered by tests that advance the simulated ledger sequence well past the default minimum
  TTL and assert data survives. See the "Storage Archival & TTL Strategy" section of
  [README.md](./README.md).
- **Emergency pause**: `pause`/`unpause` gate all state-changing entrypoints while leaving
  `verify_credential`/`get_credential` readable, so verification keeps working during an incident.
- **Revocation is monotonic and idempotent-safe**: no `unrevoke` path exists; a second
  `revoke_credential` on an already-revoked credential fails with `AlreadyRevoked`. Verified
  by `mod proptest_invariants`, which fuzzes randomized issue/revoke sequences and checks this
  (and duplicate-hash rejection, sequential token IDs, and `total_credentials` correctness) holds
  after every step, not just in a handful of hand-picked scenarios.

## Test additions from this review

All added to `contracts/src/lib.rs`:

- `test_initialize_requires_owner_auth`, `test_transfer_owner_requires_owner_auth`,
  `test_accept_owner_requires_pending_owner_auth`, `test_authorize_issuer_requires_owner_auth`,
  `test_revoke_issuer_requires_owner_auth`, `test_pause_requires_owner_auth`,
  `test_unpause_requires_owner_auth`, `test_upgrade_requires_owner_auth`,
  `test_migrate_requires_owner_auth` — each disables `mock_all_auths()` mid-test via
  `env.set_auths(&[])` and proves the call is rejected *and* state is unchanged, rather than just
  asserting the source contains a `require_auth()` call.
- `test_initialize_event`, `test_upgrade_event`, `test_migrate_event` — cover the new events.
- `mod proptest_invariants::invariant_issuance_and_revocation_hold` — property/fuzz test over
  randomized issue/revoke operation sequences (proptest, 48 cases per run, auto-shrinking on
  failure) asserting: token IDs are sequential; a hash backs at most one credential ever; only the
  recorded issuer can revoke; revocation is monotonic; `total_credentials` always equals the
  number of successful issuances; every issued credential stays retrievable by ID and by hash with
  state matching the model.

- `test_issue_credential_at_max_uri_len_succeeds`,
  `test_issue_credential_rejects_oversized_uri`, `test_batch_issue_at_max_uri_len_succeeds`,
  `test_batch_issue_rejects_oversized_uri_per_row` — boundary coverage for the F-7 cap on both
  issuance entrypoints.

Run with `cargo test --lib` from `contracts/`. Total: 68 tests, all passing.
