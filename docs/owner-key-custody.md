# Owner Key Custody Decision

**Issue**: [#279 — Contract owner key custody is undecided](https://github.com/soumen0818/ACREDIA-STELLAR/issues/279)
**Status**: Decided — multisig recommended, transfer procedure documented
**Last reviewed**: 2026-09-29

---

## 1. Decision

The `AcrediaCredential` contract owner key **must not** reside on any developer
workstation at mainnet launch. The selected custody mechanism is:

**Stellar account-level multisig** (N-of-M threshold, e.g. 2-of-3 signers).

No contract change is required. The existing `transfer_owner` / `accept_owner`
two-step handover (contracts/src/lib.rs lines 283–322) already provides a safe
handover path. Stellar account-level multisig operates at the account layer and
is transparent to the contract.

### Why multisig, not a hardware wallet alone?

| Option | Survives one person unavailable? | Survives key loss? |
|---|---|---|
| Single hardware wallet | ❌ No | ❌ No |
| HSM (single custodian) | ❌ No | ❌ No |
| Stellar multisig (2-of-3) | ✅ Yes | ✅ Yes (1 key lost) |

Multisig is the only option that tolerates a single holder being unavailable
or a single key being lost, which is the minimum acceptable posture for a
mainnet governance key.

---

## 2. Custody arrangement

### 2.1 Key holders

A minimum of **three** independent signers must be designated before mainnet
launch. Each signer:

- Holds their signing key on a hardware wallet (Ledger or equivalent), not on
  a networked machine.
- Is a named, identifiable team member or trustee — not a shared account.
- Has independently verified they can sign a Stellar transaction before the
  arrangement goes live.

Exact holder names are recorded in the team's internal security registry
(not in this public document).

### 2.2 Approval threshold

The multisig account requires **2-of-3 signatures** for any privileged
operation. This means:

- Authorizing a new issuer requires two holders to co-sign.
- Initiating an ownership transfer (`transfer_owner`) requires two co-signers.
- No single holder can act unilaterally.

### 2.3 What counts as an authorized use?

Authorizing an issuer is **not** a routine operation. Before any privileged
transaction is submitted:

1. A written request is filed (GitHub issue or equivalent internal tracker).
2. At least two key holders review and approve the request asynchronously.
3. The transaction is constructed and reviewed before signing — never signed
   blind.
4. The signed transaction hash and outcome are logged in the request thread.

---

## 3. Recovery procedure

### 3.1 One key compromised or lost

- The remaining two holders immediately initiate `transfer_owner` to a new
  multisig account that excludes the compromised key.
- The compromised key's Stellar account is merged or its weight set to zero
  on the multisig account.
- A replacement holder is identified and onboarded within 30 days.

### 3.2 Two keys compromised simultaneously

This is the catastrophic case. With a 2-of-3 setup, two compromised keys means
an attacker can also reach the 2-of-3 threshold.

**Immediate response**:
1. The remaining holder (or any two-signer set that still exists) immediately
   initiates `transfer_owner` to a newly generated emergency multisig.
2. The contract is paused (`pause`) if the remaining key has solo signing weight
   for that operation — pause requires only the owner, not a threshold.
3. All issued credentials remain valid and verifiable; the pause only blocks
   new issuance.
4. Incident is disclosed publicly with a timeline.

### 3.3 Owner key entirely lost (all holders unavailable)

If the 2-of-3 threshold is permanently unachievable:

- No new issuers can ever be authorized on that contract instance.
- Existing credentials remain permanently verifiable on-chain (they are stored
  under persistent storage keys tied to the credential, not the owner).
- A new contract must be deployed and initialized with a new owner from the
  start. Existing institutions migrate by re-authorization on the new contract.
- This is the consequence of losing a governance key with no recovery path in
  the contract — the operational mitigation is maintaining the 2-of-3 threshold
  and rotating promptly when a key is lost (§3.1).

---

## 4. Ownership transfer at mainnet launch

The transfer procedure from a dev-machine key to the multisig account must be
**rehearsed on testnet** before mainnet launch. The steps are:

### Step 1 — Set up the multisig account

```bash
# Create or designate the multisig Stellar account.
# Add three signers (replace GXXX with actual public keys):
stellar tx new set-options \
  --network testnet \
  --source <multisig-account> \
  --signer-key GXXX1 --signer-weight 1 \
  --signer-key GXXX2 --signer-weight 1 \
  --signer-key GXXX3 --signer-weight 1 \
  --low-threshold 2 \
  --med-threshold 2 \
  --high-threshold 2
```

### Step 2 — Initiate transfer (current owner signs)

```bash
# Current owner (dev machine / testnet keypair) initiates the transfer.
stellar contract invoke \
  --network testnet \
  --source <current-owner-secret> \
  --id <CONTRACT_ID> \
  -- transfer_owner \
  --new_owner <multisig-account-address>
```

Verify the `own_xfer` event appears on-chain before proceeding.

### Step 3 — Accept transfer (multisig signs)

The multisig account must reach the 2-of-3 threshold to sign the `accept_owner`
invocation. Collect signatures from two holders:

```bash
# Build and sign the transaction (repeat for second signer):
stellar contract invoke \
  --network testnet \
  --source <signer-1-secret> \
  --id <CONTRACT_ID> \
  -- accept_owner
# Second signer co-signs and submits.
```

Verify the `own_acpt` event on-chain. Confirm `read_owner()` returns the
multisig account address.

### Step 4 — Verify

```bash
stellar contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  -- read_owner
# Must return the multisig account address, not the dev keypair.
```

### Step 5 — Retire the dev key

The dev-machine keypair used during testnet/initialization must not be used
for mainnet. It should be treated as burned after the handover is confirmed.

---

## 5. Acceptance criteria (tracking)

- [ ] Multisig account created with 2-of-3 threshold, all holders verified.
- [ ] Transfer rehearsed on testnet, all steps above executed and logged.
- [ ] `own_xfer` and `own_acpt` events confirmed on testnet ledger.
- [ ] `read_owner()` on testnet returns the multisig address, not a dev key.
- [ ] Mainnet deploy initializes directly to the multisig account (owner key
      never touches a developer workstation for the mainnet deployment).
- [ ] `docs/mainnet-readiness.md` §3.2 updated to ✅.

---

## 6. Out of scope

Implementing multisig in the contract — Stellar account-level multisig already
covers this requirement. No contract change is needed or recommended.
The existing `transfer_owner` / `accept_owner` mechanism is sufficient.
