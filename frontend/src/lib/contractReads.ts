/**
 * Server-side Soroban read helpers.
 * These run in Node.js (API routes) — no Freighter, no browser SDK quirks.
 * All functions use simulateTransaction for read-only contract calls.
 */
import {
    rpc,
    Contract,
    TransactionBuilder,
    Account,
    TimeoutInfinite,
    Address,
    nativeToScVal,
    scValToNative,
    xdr,
} from '@stellar/stellar-sdk';
import { credentialHashBytesToHex, credentialHashHexToScVal } from './credentialHashEncoding';
import { runtimeConfig } from './runtimeConfig';

const RPC_URL = runtimeConfig.stellar.sorobanRpcUrl;
const NETWORK_PASSPHRASE = runtimeConfig.stellar.networkPassphrase;
const CONTRACT_ID = runtimeConfig.contracts.CREDENTIAL_NFT;

// Dummy funded account used as transaction source for read-only simulations.
// The contract itself is always present on-ledger, so we borrow its address.
const DUMMY_SOURCE = CONTRACT_ID;

const server = new rpc.Server(RPC_URL);

export class ContractConfigurationError extends Error {
    constructor(message: string = 'Missing contract configuration') {
        super(message);
        this.name = 'ContractConfigurationError';
    }
}

export class BlockchainUnavailableError extends Error {
    constructor(message: string = 'Blockchain verification unavailable') {
        super(message);
        this.name = 'BlockchainUnavailableError';
    }
}

export class CredentialNotFoundError extends Error {
    constructor(message: string = 'Credential not found on chain') {
        super(message);
        this.name = 'CredentialNotFoundError';
    }
}

export interface OnChainCredential {
    token_id?: bigint | number;
    student: string;
    issuer: string;
    hash: string;
    uri: string;
    issued_at: bigint | number;
    revoked?: boolean;
}

async function simulate(method: string, args: xdr.ScVal[]): Promise<unknown> {
    if (!CONTRACT_ID) {
        throw new ContractConfigurationError('Missing contract configuration: CONTRACT_ID not configured');
    }

    const contract = new Contract(CONTRACT_ID);
    // Use a dummy Account with sequence "0" — valid for read-only simulation
    const source = new Account(DUMMY_SOURCE, '0');

    let sim;
    try {
        const tx = new TransactionBuilder(source, {
            fee: '100',
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call(method, ...args))
            .setTimeout(TimeoutInfinite)
            .build();
        sim = await server.simulateTransaction(tx as never);
    } catch (error) {
        throw new BlockchainUnavailableError(
            `RPC error during simulation of ${method}: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    if ('error' in sim) {
        const errStr = String((sim as { error: string }).error);
        if (
            errStr.includes('CredentialNotFound') ||
            errStr.includes('ContractError(4)') ||
            errStr.includes('Codes(4)') ||
            errStr.includes('Error(Contract, 4)')
        ) {
            throw new CredentialNotFoundError(errStr);
        }
        throw new BlockchainUnavailableError(`Simulation error (${method}): ${errStr}`);
    }
    const retval = (sim as { result?: { retval?: unknown } }).result?.retval;
    if (retval === undefined || retval === null) return null;

    // retval may be an xdr.ScVal object or a base64 string depending on SDK version
    if (typeof retval === 'string') {
        try {
            return scValToNative(xdr.ScVal.fromXDR(retval, 'base64'));
        } catch (error) {
            throw new BlockchainUnavailableError(
                `Failed to decode return value of ${method}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
    try {
        return scValToNative(retval as xdr.ScVal);
    } catch (error) {
        throw new BlockchainUnavailableError(
            `Failed to decode return value of ${method}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

function nativeStructToRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    if (value instanceof Map) {
        return Object.fromEntries(
            Array.from(value.entries()).map(([key, item]) => [String(key), item]),
        );
    }

    return value as Record<string, unknown>;
}

function firstPresent(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null) {
            return record[key];
        }
    }

    return undefined;
}

export function normalizeOnChainCredential(result: unknown): OnChainCredential | null {
    const record = nativeStructToRecord(result);
    if (!record) {
        return null;
    }

    const credentialHash = firstPresent(record, ['credential_hash', 'credentialHash', 'hash']);
    const ipfsHash = firstPresent(record, ['ipfs_hash', 'ipfsHash', 'uri']);

    if (!credentialHash || !ipfsHash) {
        return null;
    }

    return {
        token_id: firstPresent(record, ['token_id', 'tokenId']) as bigint | number | undefined,
        student: String(firstPresent(record, ['student']) ?? ''),
        issuer: String(firstPresent(record, ['issuer']) ?? ''),
        hash: credentialHashBytesToHex(credentialHash),
        uri: String(ipfsHash),
        issued_at: (firstPresent(record, ['issued_at', 'issuedAt']) as bigint | number) ?? 0,
        revoked: firstPresent(record, ['revoked']) as boolean | undefined,
    };
}

/**
 * Fetch full credential struct by token_id (u64).
 * Returns null if the token does not exist on-chain.
 */
export async function getCredential(tokenId: string | number): Promise<OnChainCredential | null> {
    try {
        const result = await simulate('get_credential', [
            nativeToScVal(Number(tokenId), { type: 'u64' }),
        ]);
        return normalizeOnChainCredential(result);
    } catch (error) {
        if (error instanceof CredentialNotFoundError) {
            return null;
        }
        throw error;
    }
}

/**
 * Look up a credential by its SHA-256 hash.
 * Returns the full credential struct or null if not found.
 */
export async function verifyCredentialByHash(hash: string): Promise<OnChainCredential | null> {
    try {
        const result = await simulate('verify_credential', [credentialHashHexToScVal(hash)]);
        return normalizeOnChainCredential(result);
    } catch (error) {
        if (error instanceof CredentialNotFoundError) {
            return null;
        }
        throw error;
    }
}

/**
 * Check whether a credential has been revoked on-chain.
 */
export async function isRevoked(tokenId: string | number): Promise<boolean> {
    try {
        const result = await simulate('is_revoked', [
            nativeToScVal(Number(tokenId), { type: 'u64' }),
        ]);
        return result === true;
    } catch (error) {
        if (error instanceof CredentialNotFoundError) {
            return false;
        }
        throw error;
    }
}

export async function isAuthorizedIssuer(issuerAddress: string): Promise<boolean> {
    try {
        const result = await simulate('is_authorized_issuer', [
            new Address(issuerAddress).toScVal(),
        ]);
        return result === true;
    } catch (error) {
        if (error instanceof CredentialNotFoundError) {
            return false;
        }
        throw error;
    }
}
