'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { toast } from 'sonner';

import { captureException } from '@/lib/debug';
import { getE2eState } from '@/lib/e2e';
import { createE2eSigner } from '@/lib/e2eLedger';
import type { StellarSigner } from '@/lib/stellarSigner';
import { WalletUserRejectedError, walletAdapter, type WalletCapabilities } from '@/lib/wallet';
import { createWalletSigner } from '@/lib/wallet/signer';

interface StellarContextType {
    address: string | null;
    /** Which wallet the user actually chose, for copy that used to say "Freighter". */
    walletId: string | null;
    walletName: string | null;
    /** What that wallet can do — notably whether `/claim` can use it. */
    capabilities: WalletCapabilities | null;
    /**
     * The connected wallet as a {@link StellarSigner}, or null when
     * disconnected (ACREDIA-STELLAR#3).
     *
     * Contract calls take this rather than a bare address. Built here so no
     * component has to assemble one, and so the E2E fake is substituted in
     * exactly one place instead of being branched on inside `contracts.ts`.
     */
    signer: StellarSigner | null;
    isConnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const StellarContext = createContext<StellarContextType>({
    address: null,
    walletId: null,
    walletName: null,
    capabilities: null,
    signer: null,
    isConnecting: false,
    connect: async () => {},
    disconnect: () => {},
});

export const StellarProvider = ({ children }: { children: React.ReactNode }) => {
    const [address, setAddress] = useState<string | null>(null);
    const [walletId, setWalletId] = useState<string | null>(null);
    const [walletName, setWalletName] = useState<string | null>(null);
    const [capabilities, setCapabilities] = useState<WalletCapabilities | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        // Silently restore a previously-chosen wallet on load.
        //
        // IMPORTANT: `restore()` must never open a wallet popup. A prompt with
        // no user gesture behind it is hostile, is commonly blocked by the
        // browser, and for hardware wallets can leave a device waiting on
        // input nobody asked for. The adapter upholds this by reading the
        // already-granted permission rather than requesting access; keep any
        // change to that path under the same rule.
        const restore = async () => {
            try {
                const restored = await walletAdapter.restore();
                if (cancelled || !restored) return;

                setAddress(restored.address);
                setWalletId(restored.walletId);
                setWalletName(restored.walletName);
                setCapabilities(restored.capabilities);
            } catch {
                // Wallet locked, uninstalled, or permission revoked. Start
                // disconnected — the Connect button is right there.
            }
        };

        restore();
        return () => {
            cancelled = true;
        };
    }, []);

    const connect = useCallback(async () => {
        setIsConnecting(true);
        try {
            const connected = await walletAdapter.connect();
            setAddress(connected.address);
            setWalletId(connected.walletId);
            setWalletName(connected.walletName);
            setCapabilities(connected.capabilities);
            toast.success(`Connected with ${connected.walletName}`);
        } catch (error: unknown) {
            // A user closing the modal is a decision, not a fault. Reporting
            // it as an error trains people to distrust the error channel.
            if (error instanceof WalletUserRejectedError) {
                toast.info(error.message);
                return;
            }

            captureException(error, { context: 'connectWallet' });
            toast.error(
                (error instanceof Error ? error.message : String(error)) ||
                    'Could not connect your wallet.',
            );
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        void walletAdapter.disconnect();
        setAddress(null);
        setWalletId(null);
        setWalletName(null);
        setCapabilities(null);
        toast.info('Wallet disconnected from app level.');
    }, []);

    /**
     * The signer handed to contract calls.
     *
     * The E2E substitution happens here and nowhere else. `contracts.ts` used
     * to ask `getE2eState()` six separate times to work out whether it was
     * under test; now it only has to look at the signer it was given.
     */
    const signer = useMemo<StellarSigner | null>(() => {
        if (!address) return null;

        if (getE2eState()?.enabled) {
            return createE2eSigner(address);
        }

        return createWalletSigner(address, capabilities);
    }, [address, capabilities]);

    return (
        <StellarContext.Provider
            value={{
                address,
                walletId,
                walletName,
                capabilities,
                signer,
                isConnecting,
                connect,
                disconnect,
            }}
        >
            {children}
        </StellarContext.Provider>
    );
};

export const useStellarAccount = () => useContext(StellarContext);
