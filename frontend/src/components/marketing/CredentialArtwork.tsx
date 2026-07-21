import { cn } from '@/lib/utils';

/**
 * Brand illustration: a verified academic credential scene.
 * Self-contained (white card + navy/gold accents) so it reads well on both
 * light and deep-navy backgrounds. Used in the home hero and the auth panels.
 */
export function CredentialArtwork({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 600 540"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="A verified academic credential secured on the Stellar blockchain"
            className={cn('h-auto w-full', className)}
        >
            <defs>
                <filter id="ca-cardShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="20" stdDeviation="26" floodColor="#0A2540" floodOpacity="0.16" />
                </filter>
                <filter id="ca-chipShadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#0A2540" floodOpacity="0.14" />
                </filter>
                <linearGradient id="ca-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#D9B64E" />
                    <stop offset="1" stopColor="#B8892A" />
                </linearGradient>
            </defs>

            {/* Ambient blobs */}
            <circle cx="120" cy="430" r="140" fill="#0A2540" opacity="0.05" />
            <circle cx="510" cy="120" r="120" fill="#C19A2E" opacity="0.08" />

            {/* Decorative ring + dots */}
            <circle cx="520" cy="120" r="48" fill="none" stroke="#D9B64E" strokeWidth="2" opacity="0.55" />
            <circle cx="70" cy="200" r="6" fill="#C19A2E" opacity="0.6" />
            <circle cx="548" cy="330" r="5" fill="#0A2540" opacity="0.25" />
            <circle cx="300" cy="70" r="4" fill="#0A2540" opacity="0.2" />
            {/* gold sparkle */}
            <path
                d="M150 96 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 l14 -6 z"
                fill="url(#ca-gold)"
                opacity="0.85"
            />

            {/* Main credential card */}
            <g filter="url(#ca-cardShadow)">
                <rect x="90" y="150" width="384" height="252" rx="22" fill="#FFFFFF" stroke="#EAEFF5" strokeWidth="1.5" />
            </g>

            {/* Header: shield badge + label */}
            <rect x="116" y="176" width="36" height="36" rx="11" fill="#0A2540" />
            <path
                d="M126 194 l5 5 l10 -11"
                fill="none"
                stroke="url(#ca-gold)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <text x="164" y="199" fontSize="12.5" fontWeight="600" letterSpacing="1.4" fill="#5A6B80">
                VERIFIED CREDENTIAL
            </text>

            {/* Authentic pill */}
            <rect x="360" y="180" width="90" height="28" rx="14" fill="#E7F3EE" />
            <path
                d="M375 194 l4 4 l8 -9"
                fill="none"
                stroke="#12805C"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <text x="392" y="199" fontSize="12.5" fontWeight="600" fill="#12805C">
                Authentic
            </text>

            <line x1="116" y1="230" x2="448" y2="230" stroke="#EEF2F7" strokeWidth="1.5" />

            {/* Degree */}
            <text x="116" y="262" fontSize="11" fontWeight="600" letterSpacing="1.5" fill="#8A97A8">
                BACHELOR OF SCIENCE
            </text>
            <text x="116" y="292" fontSize="25" fontWeight="700" fill="#0F2136">
                Computer Science
            </text>

            <line x1="116" y1="326" x2="448" y2="326" stroke="#EEF2F7" strokeWidth="1.5" />

            {/* Issuer + QR */}
            <text x="116" y="352" fontSize="10.5" fontWeight="600" letterSpacing="1.2" fill="#8A97A8">
                ISSUED BY
            </text>
            <text x="116" y="374" fontSize="16" fontWeight="700" fill="#0F2136">
                Stellar University
            </text>
            <rect x="398" y="336" width="48" height="48" rx="9" fill="#0A2540" />
            <g fill="#FFFFFF">
                <rect x="406" y="344" width="10" height="10" rx="2" />
                <rect x="428" y="344" width="10" height="10" rx="2" />
                <rect x="406" y="366" width="10" height="10" rx="2" />
                <rect x="421" y="359" width="6" height="6" rx="1" opacity="0.7" />
                <rect x="428" y="366" width="10" height="4" rx="1" opacity="0.7" />
                <rect x="434" y="372" width="4" height="4" rx="1" opacity="0.7" />
            </g>

            {/* Floating "on-chain" badge */}
            <g filter="url(#ca-chipShadow)">
                <rect x="38" y="150" width="140" height="52" rx="15" fill="#FFFFFF" />
            </g>
            <circle cx="66" cy="176" r="13" fill="#E7F3EE" />
            <path
                d="M60 176 l4 4 l8 -9"
                fill="none"
                stroke="#12805C"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <text x="88" y="172" fontSize="12.5" fontWeight="700" fill="#0F2136">
                Verified
            </text>
            <text x="88" y="188" fontSize="10.5" fill="#5A6B80">
                on-chain
            </text>

            {/* Floating "Verified in 3.2s" chip */}
            <g filter="url(#ca-chipShadow)">
                <rect x="352" y="392" width="164" height="46" rx="15" fill="#FFFFFF" />
            </g>
            <circle cx="378" cy="415" r="5.5" fill="#12805C" />
            <text x="392" y="420" fontSize="13" fontWeight="600" fill="#0F2136">
                Verified in 3.2s
            </text>

            {/* Stellar chip bottom-left */}
            <g filter="url(#ca-chipShadow)">
                <rect x="120" y="424" width="150" height="44" rx="14" fill="#0A2540" />
            </g>
            <circle cx="144" cy="446" r="6" fill="url(#ca-gold)" />
            <text x="160" y="451" fontSize="12.5" fontWeight="600" fill="#FFFFFF">
                Stellar · IPFS
            </text>
        </svg>
    );
}
