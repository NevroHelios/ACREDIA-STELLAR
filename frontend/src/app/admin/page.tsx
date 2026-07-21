'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, CheckCircle2, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AuthorizeIssuer } from '@/components/institution/AuthorizeIssuer';
import { ConnectWallet } from '@/components/ui/ConnectWallet';
import { Card } from '@/components/ui/card';
import { RouteStateScreen } from '@/components/route-state/RouteStateScreen';
import { getContractOwner } from '@/lib/contracts';
import { debugLog, debugWarn, captureException } from '@/lib/debug';
import { runtimeConfig } from '@/lib/runtimeConfig';
import { safeGetSession } from '@/lib/supabase';
import { useStellarAccount } from '@/contexts/StellarContext';
import { ProtectedRoute, useAuth } from '@/contexts/AuthContext';

interface AdminStats {
    totalInstitutions: number;
    authorizedInstitutions: number;
    totalCredentials: number;
    activeCredentials: number;
    totalStudents: number;
    verificationActivity: {
        totalAttempts: number;
        attemptsLast24h: number;
        resultCounts: {
            verified: number;
            revoked: number;
            not_found: number;
            chain_unavailable: number;
            mismatch: number;
            invalid_request: number;
            server_error: number;
        };
    };
}

function AdminDashboardContent() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const { address } = useStellarAccount();
    const [contractOwner, setContractOwner] = useState('');
    const [isOwner, setIsOwner] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [stats, setStats] = useState<AdminStats>({
        totalInstitutions: 0,
        authorizedInstitutions: 0,
        totalCredentials: 0,
        activeCredentials: 0,
        totalStudents: 0,
        verificationActivity: {
            totalAttempts: 0,
            attemptsLast24h: 0,
            resultCounts: {
                verified: 0,
                revoked: 0,
                not_found: 0,
                chain_unavailable: 0,
                mismatch: 0,
                invalid_request: 0,
                server_error: 0,
            },
        },
    });
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        const checkOwnership = async () => {
            if (!address) {
                setIsChecking(false);
                return;
            }

            try {
                const owner = await getContractOwner(address);
                const ownerCheck = address.toLowerCase() === owner.toLowerCase();

                setContractOwner(owner);
                setIsOwner(ownerCheck);

                if (!ownerCheck) {
                    debugWarn('Connected wallet is not the contract owner.');
                    toast.error('This wallet is not the contract owner');
                    toast.info('Connect the wallet that deployed the contracts');
                } else {
                    debugLog('Connected wallet verified as contract owner.');
                    toast.success('Verified as Contract Owner');
                }
            } catch (error) {
                captureException(error, { context: 'checkOwnership' });
                toast.error('Failed to verify ownership: ' + (error as Error).message);
            } finally {
                setIsChecking(false);
            }
        };

        checkOwnership();
    }, [address]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoadingStats(true);
                const {
                    data: { session },
                } = await safeGetSession();

                if (!session?.access_token) {
                    toast.error('Your session expired. Please sign in again.');
                    setLoadingStats(false);
                    return;
                }

                const response = await fetch('/api/admin/stats', {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });
                const data = await response.json();

                if (data.success) {
                    setStats(data.stats);
                    debugLog('Admin statistics loaded.');
                    return;
                }

                captureException(new Error(data.error || 'Failed to fetch stats'), { context: 'fetchStats' });
                toast.error('Failed to load statistics');
            } catch (error) {
                captureException(error, { context: 'fetchStats' });
                toast.error('Failed to load statistics');
            } finally {
                setLoadingStats(false);
            }
        };

        if (!isOwner) {
            return;
        }

        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [isOwner]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    if (isChecking) {
        return (
            <RouteStateScreen
                title="Loading admin"
                description="Preparing the administration workspace..."
                variant="loading"
            />
        );
    }

    if (!address) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-secondary/30">
                <Card className="max-w-md p-8">
                    <Shield className="mx-auto mb-4 h-16 w-16 text-primary" />
                    <h2 className="mb-4 text-center text-2xl font-bold text-foreground">
                        Admin Access Required
                    </h2>
                    <p className="mb-6 text-center text-muted-foreground">
                        Please connect your wallet to access the admin dashboard
                    </p>
                    <div className="flex justify-center">
                        <ConnectWallet />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <DashboardShell
            title="Admin Dashboard"
            subtitle="Manage institution authorizations and system settings"
            icon={<Shield className="h-11 w-11 text-primary" />}
            brandBadge="ADMIN"
            onSignOut={handleSignOut}
        >
            {!isOwner && (
                <div className="mb-6 rounded-lg border border-warning/25 bg-warning/8 p-4">
                    <div className="flex items-start space-x-3">
                        <Shield className="mt-0.5 h-6 w-6 text-warning" />
                        <div>
                            <h3 className="mb-1 text-sm font-bold text-foreground">
                                Read-Only Mode: Not Contract Owner
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                You are viewing the dashboard, but you cannot authorize new
                                institutions because your currently connected wallet (
                                {address.slice(0, 6)}...{address.slice(-4)}) is not the contract
                                owner.
                                <br />
                                Actual Owner:{' '}
                                <span className="rounded bg-warning/15 px-1 font-mono">
                                    {contractOwner || 'Could not fetch'}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <Card className="mb-6 p-6">
                <div className="flex items-start space-x-4">
                    <CheckCircle2 className="mt-1 h-6 w-6 text-success" />
                    <div className="flex-1">
                        <h3 className="mb-2 text-lg font-bold text-foreground">
                            Contract Owner (Admin)
                        </h3>
                        <div className="space-y-2">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Email:</p>
                                <p className="text-sm text-foreground">{user?.email}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Wallet Address:</p>
                                <p className="break-all text-xs font-mono text-foreground">
                                    {address}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Contract Address:
                                </p>
                                <p className="break-all text-xs font-mono text-foreground">
                                    {runtimeConfig.contracts.CREDENTIAL_NFT}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <Card className="p-6">
                    <div className="mb-2 flex items-center space-x-3">
                        <Users className="h-11 w-11 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">Total Institutions</h3>
                    </div>
                    {loadingStats ? (
                        <div className="animate-pulse">
                            <div className="mb-2 h-10 w-16 rounded bg-secondary"></div>
                        </div>
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-foreground">
                                {stats.totalInstitutions}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">Registered institutions</p>
                        </>
                    )}
                </Card>

                <Card className="p-6">
                    <div className="mb-2 flex items-center space-x-3">
                        <CheckCircle2 className="h-11 w-11 text-success" />
                        <h3 className="text-lg font-semibold text-foreground">Authorized</h3>
                    </div>
                    {loadingStats ? (
                        <div className="animate-pulse">
                            <div className="mb-2 h-10 w-16 rounded bg-secondary"></div>
                        </div>
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-foreground">
                                {stats.authorizedInstitutions}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">Authorized to issue</p>
                        </>
                    )}
                </Card>

                <Card className="p-6">
                    <div className="mb-2 flex items-center space-x-3">
                        <Shield className="h-11 w-11 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">Total Credentials</h3>
                    </div>
                    {loadingStats ? (
                        <div className="animate-pulse">
                            <div className="mb-2 h-10 w-16 rounded bg-secondary"></div>
                        </div>
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-foreground">
                                {stats.totalCredentials}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {stats.activeCredentials} active,{' '}
                                {stats.totalCredentials - stats.activeCredentials} revoked
                            </p>
                        </>
                    )}
                </Card>

                <Card className="p-6">
                    <div className="mb-2 flex items-center space-x-3">
                        <Activity className="h-8 w-8 text-gold" />
                        <h3 className="text-lg font-semibold text-foreground">
                            Verification Checks
                        </h3>
                    </div>
                    {loadingStats ? (
                        <div className="animate-pulse">
                            <div className="mb-2 h-10 w-16 rounded bg-secondary"></div>
                        </div>
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-foreground">
                                {stats.verificationActivity.totalAttempts}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {stats.verificationActivity.attemptsLast24h} in last 24h
                            </p>
                        </>
                    )}
                </Card>
            </div>

            <AuthorizeIssuer />
        </DashboardShell>
    );
}

export default function AdminDashboardPage() {
    return (
        <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboardContent />
        </ProtectedRoute>
    );
}
