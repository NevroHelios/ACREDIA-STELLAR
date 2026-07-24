import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Verify Credentials - Acredia',
    description: 'Instantly verify the authenticity of academic credentials using the Stellar blockchain and IPFS.',
    openGraph: {
        title: 'Verify Credentials - Acredia',
        description: 'Instantly verify the authenticity of academic credentials using the Stellar blockchain and IPFS.',
        images: ['/verify1.png'],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Verify Credentials - Acredia',
        description: 'Instantly verify the authenticity of academic credentials using the Stellar blockchain and IPFS.',
        images: ['/verify1.png'],
    },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
