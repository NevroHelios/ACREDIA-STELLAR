import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The wallet boundary and its capability handling (ACREDIA-STELLAR#272).
 *
 * The regressions worth protecting against here are the quiet ones:
 *
 *  - A wallet that cannot sign messages letting a student all the way to the
 *    final step of `/claim` before dead-ending.
 *  - The silent-restore path opening a wallet popup on page load. That
 *    property was a comment in the old Freighter code and nothing enforced
 *    it, which is exactly how it would have been lost.
 *  - The kit being pinned to testnet while the app runs on mainnet.
 */

const KIT_PATH = '@creit.tech/stellar-wallets-kit';

/** Mock kit whose calls are all observable. */
function createKitMock() {
    return {
        init: vi.fn(),
        setWallet: vi.fn(),
        setTheme: vi.fn(),
        getAddress: vi.fn(async () => ({ address: 'GADDRESS' })),
        // If any test provokes this, the silent-restore guarantee is broken:
        // fetchAddress is the call that can raise a wallet popup.
        fetchAddress: vi.fn(async () => ({ address: 'GADDRESS' })),
        authModal: vi.fn(async () => ({ address: 'GADDRESS' })),
        signTransaction: vi.fn(async () => ({ signedTxXdr: 'SIGNED_XDR' })),
        signMessage: vi.fn(async () => ({ signedMessage: 'c2lnbmF0dXJl' })),
        disconnect: vi.fn(async () => {}),
        refreshSupportedWallets: vi.fn(async () => [
            { id: 'freighter', name: 'Freighter', isAvailable: true },
            { id: 'rabet', name: 'Rabet', isAvailable: false },
        ]),
        selectedModule: { productId: 'freighter' } as { productId: string } | undefined,
    };
}

type KitMock = ReturnType<typeof createKitMock>;

let kitMock: KitMock;

/** Every wallet module the adapter registers, stubbed. */
function stubWalletModules() {
    const moduleNames: Array<[string, string]> = [
        ['freighter', 'FreighterModule'],
        ['xbull', 'xBullModule'],
        ['albedo', 'AlbedoModule'],
        ['rabet', 'RabetModule'],
        ['lobstr', 'LobstrModule'],
        ['hana', 'HanaModule'],
        ['hotwallet', 'HotWalletModule'],
        ['klever', 'KleverModule'],
        ['onekey', 'OneKeyModule'],
        ['bitget', 'BitgetModule'],
    ];

    for (const [subpath, exportName] of moduleNames) {
        vi.doMock(`${KIT_PATH}/modules/${subpath}`, () => ({
            [exportName]: class {
                productId = subpath;
            },
        }));
    }
}

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

/**
 * Installs the mocks the adapter needs, optionally on a different network.
 *
 * `@/lib/stellar` is mocked rather than imported: the real module constructs a
 * Stellar SDK RPC server at module scope, which drags in axios and fails
 * against the synthetic `window` below.
 */
function installMocks(networkPassphrase = TESTNET_PASSPHRASE) {
    vi.doMock(KIT_PATH, () => ({ StellarWalletsKit: kitMock }));
    stubWalletModules();
    vi.doMock('@/lib/stellar', () => ({
        activeNetwork: { networkPassphrase, networkName: 'testnet' },
    }));
}

beforeEach(() => {
    vi.resetModules();
    kitMock = createKitMock();
    installMocks();

    // jsdom is not configured for this suite (environment: 'node'), so stand
    // in the browser APIs the adapter and theme reader touch. `location` is
    // present because libraries sniff for it to decide they are in a browser.
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
        location: { href: 'http://localhost/' },
        localStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => void store.set(key, value),
            removeItem: (key: string) => void store.delete(key),
        },
    });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
    vi.stubGlobal('document', { documentElement: {} });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

async function loadAdapter() {
    const mod = await import('../src/lib/wallet/adapter');
    return mod;
}

describe('capability table', () => {
    it('marks the wallets that reject signMessage at runtime', async () => {
        const { capabilitiesFor } = await import('../src/lib/wallet/capabilities');

        // Verified against the kit's module sources: both throw code -3.
        expect(capabilitiesFor('albedo').signMessage).toBe(false);
        expect(capabilitiesFor('rabet').signMessage).toBe(false);

        for (const id of ['freighter', 'xbull', 'lobstr', 'hana', 'klever', 'onekey']) {
            expect(capabilitiesFor(id).signMessage, id).toBe(true);
        }
    });

    it('treats every wallet as able to sign transactions', async () => {
        const { capabilitiesFor } = await import('../src/lib/wallet/capabilities');
        for (const id of ['albedo', 'rabet', 'freighter']) {
            expect(capabilitiesFor(id).signTransaction, id).toBe(true);
        }
    });

    it('assumes an unknown wallet is capable rather than broken', async () => {
        // A wallet added by a future kit release should work by default; the
        // cost of guessing wrong is an error at signing time, not a wallet we
        // refuse to offer for no reason.
        const { capabilitiesFor } = await import('../src/lib/wallet/capabilities');
        expect(capabilitiesFor('some-new-wallet-2027')).toEqual({
            signTransaction: true,
            signMessage: true,
        });
    });
});

describe('connect', () => {
    it('opens the selection modal and reports the chosen wallet', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        kitMock.selectedModule = { productId: 'xbull' };

        const connected = await stellarKitAdapter.connect();

        expect(kitMock.authModal).toHaveBeenCalledTimes(1);
        expect(connected).toEqual({
            address: 'GADDRESS',
            walletId: 'xbull',
            walletName: 'xBull',
            capabilities: { signTransaction: true, signMessage: true },
        });
    });

    it('themes the modal instead of shipping the kit default', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        await stellarKitAdapter.connect();

        expect(kitMock.setTheme).toHaveBeenCalledTimes(1);
        const theme = kitMock.setTheme.mock.calls[0][0] as Record<string, string>;
        expect(theme['font-family']).toContain('--font-sans');
    });

    it('persists the chosen wallet so the next visit can restore it', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        kitMock.selectedModule = { productId: 'lobstr' };

        await stellarKitAdapter.connect();

        expect(window.localStorage.getItem('acredia.wallet.selectedId')).toBe('lobstr');
    });

    it('reports a dismissed modal as a user rejection, not a failure', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        const { WalletUserRejectedError } = await import('../src/lib/wallet/types');
        kitMock.authModal.mockRejectedValueOnce({ code: -4, message: 'Modal closed by the user' });

        await expect(stellarKitAdapter.connect()).rejects.toBeInstanceOf(WalletUserRejectedError);
    });
});

describe('restore', () => {
    it('never prompts the wallet on page load', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        window.localStorage.setItem('acredia.wallet.selectedId', 'freighter');

        await stellarKitAdapter.restore();

        // The whole point: reading an already-granted permission, never
        // requesting one. fetchAddress/authModal both raise popups.
        expect(kitMock.getAddress).toHaveBeenCalledTimes(1);
        expect(kitMock.fetchAddress).not.toHaveBeenCalled();
        expect(kitMock.authModal).not.toHaveBeenCalled();
    });

    it('does not even load the kit when no wallet was remembered', async () => {
        const { stellarKitAdapter } = await loadAdapter();

        expect(await stellarKitAdapter.restore()).toBeNull();
        expect(kitMock.init).not.toHaveBeenCalled();
    });

    it('stays disconnected when the wallet is locked or uninstalled', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        window.localStorage.setItem('acredia.wallet.selectedId', 'freighter');
        kitMock.getAddress.mockRejectedValueOnce(new Error('Wallet is locked'));

        expect(await stellarKitAdapter.restore()).toBeNull();
    });

    it('restores the remembered wallet with its capabilities', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        window.localStorage.setItem('acredia.wallet.selectedId', 'rabet');

        const restored = await stellarKitAdapter.restore();

        expect(kitMock.setWallet).toHaveBeenCalledWith('rabet');
        expect(restored).toMatchObject({
            walletId: 'rabet',
            walletName: 'Rabet',
            capabilities: { signTransaction: true, signMessage: false },
        });
    });
});

describe('signTransaction', () => {
    it('returns the signed XDR string every wallet is normalised to', async () => {
        const { stellarKitAdapter } = await loadAdapter();

        const signed = await stellarKitAdapter.signTransaction('RAW_XDR', {
            networkPassphrase: 'Test SDF Network ; September 2015',
            address: 'GSIGNER',
        });

        expect(signed).toBe('SIGNED_XDR');
        expect(kitMock.signTransaction).toHaveBeenCalledWith('RAW_XDR', {
            networkPassphrase: 'Test SDF Network ; September 2015',
            address: 'GSIGNER',
        });
    });

    it('fails loudly rather than returning an empty signature', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        kitMock.signTransaction.mockResolvedValueOnce({ signedTxXdr: '' });

        await expect(
            stellarKitAdapter.signTransaction('RAW_XDR', {
                networkPassphrase: 'Test SDF Network ; September 2015',
                address: 'GSIGNER',
            }),
        ).rejects.toThrow(/no signed transaction/i);
    });

    it('maps a wallet cancellation to a user rejection', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        const { WalletUserRejectedError } = await import('../src/lib/wallet/types');
        kitMock.signTransaction.mockRejectedValueOnce(new Error('User declined the request'));

        await expect(
            stellarKitAdapter.signTransaction('RAW_XDR', {
                networkPassphrase: 'Test SDF Network ; September 2015',
                address: 'GSIGNER',
            }),
        ).rejects.toBeInstanceOf(WalletUserRejectedError);
    });
});

describe('signMessage', () => {
    const opts = {
        networkPassphrase: 'Test SDF Network ; September 2015',
        address: 'GSIGNER',
    };

    it('refuses before calling a wallet that cannot sign messages', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        const { WalletCapabilityError } = await import('../src/lib/wallet/types');
        kitMock.selectedModule = { productId: 'albedo' };

        const error = await stellarKitAdapter.signMessage('hello', opts).catch((e) => e);

        expect(error).toBeInstanceOf(WalletCapabilityError);
        expect(error.walletName).toBe('Albedo');
        // Not attempted: the point is a clear message, not an opaque -3.
        expect(kitMock.signMessage).not.toHaveBeenCalled();
    });

    it('translates the kit’s -3 "not supported" into a capability error', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        const { WalletCapabilityError } = await import('../src/lib/wallet/types');
        // A wallet not in our table that still rejects as unsupported.
        kitMock.selectedModule = { productId: 'future-wallet' };
        kitMock.signMessage.mockRejectedValueOnce({
            code: -3,
            message: 'Not supported',
        });

        await expect(stellarKitAdapter.signMessage('hello', opts)).rejects.toBeInstanceOf(
            WalletCapabilityError,
        );
    });

    it('returns the signature for a capable wallet', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        kitMock.selectedModule = { productId: 'freighter' };

        expect(await stellarKitAdapter.signMessage('hello', opts)).toBe('c2lnbmF0dXJl');
    });
});

describe('network selection', () => {
    it('follows activeNetwork rather than hardcoding testnet', async () => {
        vi.resetModules();
        installMocks('Public Global Stellar Network ; September 2015');

        const { stellarKitAdapter } = await import('../src/lib/wallet/adapter');
        await stellarKitAdapter.connect();

        expect(kitMock.init).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'Public Global Stellar Network ; September 2015',
            }),
        );
    });

    it('falls back to testnet for an unrecognised passphrase', async () => {
        vi.resetModules();
        installMocks('Some Private Chain ; 2026');

        const { stellarKitAdapter } = await import('../src/lib/wallet/adapter');
        await stellarKitAdapter.connect();

        // Failing safe: a testnet signature is worthless on mainnet, never
        // the reverse.
        expect(kitMock.init).toHaveBeenCalledWith(
            expect.objectContaining({ network: 'Test SDF Network ; September 2015' }),
        );
    });
});

describe('kit lifecycle', () => {
    it('initialises once even under concurrent callers', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        window.localStorage.setItem('acredia.wallet.selectedId', 'freighter');

        // A restore on mount racing a click on Connect must not init twice —
        // the kit's API is static, and a second init resets the selection.
        await Promise.all([
            stellarKitAdapter.restore(),
            stellarKitAdapter.connect(),
            stellarKitAdapter.listWallets(),
        ]);

        expect(kitMock.init).toHaveBeenCalledTimes(1);
    });

    it('clears the remembered wallet on disconnect', async () => {
        const { stellarKitAdapter } = await loadAdapter();
        window.localStorage.setItem('acredia.wallet.selectedId', 'freighter');

        await stellarKitAdapter.restore();
        await stellarKitAdapter.disconnect();

        expect(window.localStorage.getItem('acredia.wallet.selectedId')).toBeNull();
        expect(kitMock.disconnect).toHaveBeenCalled();
    });

    it('does not load the kit merely to disconnect', async () => {
        const { stellarKitAdapter } = await loadAdapter();

        await stellarKitAdapter.disconnect();

        expect(kitMock.init).not.toHaveBeenCalled();
    });

    it('lists wallets with availability resolved', async () => {
        const { stellarKitAdapter } = await loadAdapter();

        expect(await stellarKitAdapter.listWallets()).toEqual([
            { id: 'freighter', name: 'Freighter', isAvailable: true },
            { id: 'rabet', name: 'Rabet', isAvailable: false },
        ]);
    });
});
