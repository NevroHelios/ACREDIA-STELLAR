'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CredentialArtwork } from '@/components/marketing/CredentialArtwork';

interface AuthShellProps {
    title: ReactNode;
    subtitle?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    /** Optional accent for the brand panel (e.g. admin). */
    variant?: 'default' | 'admin';
}

export function AuthShell({ title, subtitle, children, footer, variant = 'default' }: AuthShellProps) {
    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            {/* Brand panel */}
            <div className="relative hidden overflow-hidden bg-brand-mesh p-12 lg:flex lg:flex-col lg:justify-between">
                <Link href="/" className="relative flex items-center gap-2.5">
                    <Image
                        src="/Acredia.png"
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain"
                    />
                    <span className="text-xl font-bold tracking-tight text-white">Acredia</span>
                </Link>

                <div className="relative max-w-md">
                    <CredentialArtwork className="mb-10 w-full max-w-sm" />
                    <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
                        {variant === 'admin'
                            ? 'Administrator console access.'
                            : 'Credentials the world can trust.'}
                    </h2>
                    <p className="mt-4 text-sm leading-6 text-white/70">
                        {variant === 'admin'
                            ? 'Manage institution authorizations and system settings from one secure place.'
                            : 'Issue, own, and verify tamper-proof academic credentials on the Stellar network.'}
                    </p>
                </div>

                <div className="relative inline-flex items-center gap-2 text-xs font-medium text-white/60">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                    </span>
                    Live on Stellar Testnet
                </div>
            </div>

            {/* Form panel */}
            <div className="flex flex-col justify-center bg-background px-4 py-10 sm:px-6 lg:px-12">
                <div className="mx-auto w-full max-w-md">
                    <Link
                        href="/"
                        className="mb-8 flex items-center gap-2.5 lg:hidden"
                        aria-label="Acredia home"
                    >
                        <Image
                            src="/Acredia.png"
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 object-contain"
                        />
                        <span className="text-lg font-bold tracking-tight text-foreground">
                            Acredia
                        </span>
                    </Link>

                    <div className="mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
                        )}
                    </div>

                    {children}

                    {footer && <div className="mt-8">{footer}</div>}

                    <div className="mt-8 border-t border-border pt-6">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
