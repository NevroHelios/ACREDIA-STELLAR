import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/lib/securityHeaders';

const nextConfig: NextConfig = {
    // Pin the project root to this frontend directory. Without this, Next infers
    // the workspace root from the nearest lockfile and picks the stray empty
    // package-lock.json at the repo root, emitting a "multiple lockfiles" warning
    // and tracing files from the wrong directory.
    outputFileTracingRoot: __dirname,

    // ── Security headers ────────────────────────────────────────────────────
    async headers() {
        return buildSecurityHeaders(process.env.NODE_ENV === 'production');
    },

    turbopack: {
        root: __dirname,
    },
    webpack: (config, { isServer }) => {
        // Ignore test files and development dependencies from thread-stream
        config.module = config.module || {};
        config.module.rules = config.module.rules || [];

        // Use null-loader to ignore test, bench, and non-JS files
        config.module.rules.push({
            test: /node_modules\/thread-stream\/(test|bench)\/.*/,
            use: 'null-loader',
        });

        config.module.rules.push({
            test: /node_modules\/thread-stream\/(LICENSE|README\.md)/,
            use: 'null-loader',
        });

        // Fallbacks for node modules
        config.resolve = config.resolve || {};
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
            pino: false,
            'pino-pretty': false,
            encoding: false,
        };

        // Externalize thread-stream on server side
        if (isServer) {
            config.externals = config.externals || [];
            if (Array.isArray(config.externals)) {
                config.externals.push({
                    'thread-stream': 'commonjs thread-stream',
                });
            }
        }

        return config;
    },

    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'gateway.pinata.cloud' },
            { protocol: 'https', hostname: '**.ipfs.dweb.link' },
            { protocol: 'https', hostname: 'ipfs.io' },
            { protocol: 'https', hostname: 'res.cloudinary.com' },
        ],
    },

    experimental: {
        // Optimize package imports
        optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
    },
};

export default nextConfig;
