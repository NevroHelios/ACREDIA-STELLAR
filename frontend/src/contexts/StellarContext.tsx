'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAddress, isAllowed, isConnected, requestAccess, setAllowed } from '@stellar/freighter-api';
import { toast } from 'sonner';

import { captureException } from '@/lib/debug';

interface StellarContextType {
    address: string | null;
    isConnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const StellarContext = createContext<StellarContextType>({
    address: null,
    isConnecting: false,
    connect: async () => {},
    disconnect: () => {},
});

export const StellarProvider = ({ children }: { children: React.ReactNode }) => {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Silently restore a previously-approved connection on load.
        // IMPORTANT: never call requestAccess()/setAllowed() here — those open the
        // Freighter extension popup, which must only happen on an explicit user
        // action (the Connect button). We only read state the wallet already has.
        const restoreConnection = async () => {
            try {
                const { isConnected: hasFreighter } = await isConnected();
                if (!hasFreighter) return; // extension not installed

                const { isAllowed: appAllowed } = await isAllowed();
                if (!appAllowed) return; // user hasn't authorized this app yet — do not prompt

                const { address } = await getAddress(); // no popup when already allowed
                if (address) {
                    setAddress(address);
                    setError(null);
                }
            } catch {
                // Ignore silently: wallet locked, not installed, or not yet authorized.
            }
        };
        restoreConnection();
    }, []);

    const connect = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const { isConnected: hasFreighter } = await isConnected();
            if (!hasFreighter) {
                const msg = 'Freighter wallet not detected. Please install the browser extension!';
                setError(msg);
                toast.error(msg);
                setIsConnecting(false);
                return;
            }

            await setAllowed();
            const { address, error: accessError } = await requestAccess();
            if (accessError) {
                throw new Error(accessError.message ?? String(accessError));
            }
            if (address) {
                setAddress(address);
                setError(null);
                toast.success('Wallet connected!');
            }
        } catch (error: unknown) {
            captureException(error, { context: 'connectFreighter' });
            let msg = (error instanceof Error ? error.message : String(error)) || 'Connection refused';
            // Detect user cancellation
            if (msg.includes('User canceled') || msg.includes('canceled')) {
                msg = 'Connection canceled by user';
            } else if (msg.includes('not installed')) {
                msg = 'Freighter wallet not found. Please install it first.';
            }
            setError(msg);
            toast.error(msg);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = () => {
        setAddress(null);
        setError(null);
        toast.info('Wallet disconnected from app level.');
    };

    return (
        <StellarContext.Provider value={{ address, isConnecting, connect, disconnect }}>
            {children}
        </StellarContext.Provider>
    );
};

export const useStellarAccount = () => useContext(StellarContext);
