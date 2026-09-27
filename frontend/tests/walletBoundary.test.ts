import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the wallet boundary as a fact about the tree, not a convention
 * (ACREDIA-STELLAR#272).
 *
 * Acredia was Freighter-only because `@stellar/freighter-api` was imported in
 * three separate layers — the connection context, the contract-signing helper
 * and a page component. Multi-wallet support only stays true if that cannot
 * come back, so this asserts the acceptance criterion directly: no file
 * outside `src/lib/wallet/` imports a wallet library.
 *
 * eslint enforces the same rule at build time (`no-restricted-imports` in
 * eslint.config.mjs). This is here because the rule is easy to weaken with an
 * inline disable comment, which a test notices and a passing lint run does not.
 */

const SRC = join(process.cwd(), 'src');
const ADAPTER_DIR = join(SRC, 'lib', 'wallet');

/** Wallet libraries that may only be reached through the adapter. */
const WALLET_LIBRARIES = ['@creit.tech/stellar-wallets-kit', '@stellar/freighter-api'];

function walkTypeScriptFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walkTypeScriptFiles(full);
        return /\.tsx?$/.test(entry) ? [full] : [];
    });
}

/**
 * Finds wallet-library specifiers in `import`/`export … from` and dynamic
 * `import()`. Matching the specifier string rather than the whole statement
 * keeps multi-line imports in scope.
 */
function walletImportsIn(source: string): string[] {
    return WALLET_LIBRARIES.filter((library) => {
        const pattern = new RegExp(
            `(?:from|import)\\s*\\(?\\s*['"]${library.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:/[^'"]*)?['"]`,
        );
        return pattern.test(source);
    });
}

describe('wallet library boundary', () => {
    const files = walkTypeScriptFiles(SRC);

    it('finds source files to check', () => {
        // A path typo would otherwise make every assertion below vacuous.
        expect(files.length).toBeGreaterThan(50);
    });

    it('confines wallet libraries to src/lib/wallet/', () => {
        const offenders = files
            .filter((file) => !file.startsWith(ADAPTER_DIR))
            .flatMap((file) => {
                const found = walletImportsIn(readFileSync(file, 'utf8'));
                return found.map((library) => `${relative(process.cwd(), file)} → ${library}`);
            });

        expect(
            offenders,
            'These files import a wallet library directly. Use the WalletAdapter from @/lib/wallet instead — ' +
                'a second import site is how Acredia became Freighter-only in the first place.',
        ).toEqual([]);
    });

    it('keeps the adapter as the one place the kit is reached', () => {
        const importers = files
            .filter((file) => file.startsWith(ADAPTER_DIR))
            .filter((file) => walletImportsIn(readFileSync(file, 'utf8')).length > 0)
            .map((file) => relative(ADAPTER_DIR, file));

        expect(importers).toEqual(['adapter.ts']);
    });

    it('no longer depends on @stellar/freighter-api directly', () => {
        const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };

        // The kit still pulls Freighter in transitively — that is how it talks
        // to the extension. What matters is that Acredia no longer declares it,
        // so nothing here can import it by accident.
        expect(pkg.dependencies ?? {}).not.toHaveProperty('@stellar/freighter-api');
        expect(pkg.devDependencies ?? {}).not.toHaveProperty('@stellar/freighter-api');
        expect(pkg.dependencies ?? {}).toHaveProperty('@creit.tech/stellar-wallets-kit');
    });
});

describe('user-facing copy', () => {
    const files = walkTypeScriptFiles(SRC);

    /**
     * "Install Freighter" copy is the adoption ceiling in words: it tells a
     * user with a perfectly good wallet that they have the wrong one. Naming
     * Freighter as *one option among several* is fine and is what the claim
     * page does; naming it as a requirement is not.
     */
    it('never presents Freighter as a requirement', () => {
        const requirementPhrasing =
            /(install|installed|need|requires?|must have|not detected|not found)[^.\n]{0,40}Freighter|Freighter[^.\n]{0,40}(is required|must be installed|not detected|not found|wallet not)/i;

        const offenders = files
            .filter((file) => !file.startsWith(ADAPTER_DIR))
            .filter((file) => requirementPhrasing.test(readFileSync(file, 'utf8')))
            .map((file) => relative(process.cwd(), file));

        expect(
            offenders,
            'Copy in these files presents Freighter as a requirement. Name the wallet the user actually chose ' +
                '(`walletName` from useStellarAccount), or speak of "your wallet".',
        ).toEqual([]);
    });
});
