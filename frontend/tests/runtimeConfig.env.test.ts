import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime config environment validation', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        delete process.env.NEXT_PHASE;
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    it('logs a clear error and degrades gracefully when required runtime values are missing', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Importing must NOT throw: a missing public value should never crash the
        // whole app (which would show the global error screen in the browser or
        // fail the production build). It degrades to empty values instead.
        const mod = await import('../src/lib/runtimeConfig');

        expect(mod.runtimeConfig.supabase.url).toBe('');
        expect(mod.runtimeConfig.supabase.anonKey).toBe('');
        expect(mod.runtimeConfig.isProduction).toBe(true);

        // The misconfiguration is still surfaced loudly and actionably.
        expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/NEXT_PUBLIC_SUPABASE_URL/));

        errorSpy.mockRestore();
    });

    it('exposes a typed server runtime config for admin and pinata settings', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');

        const { serverRuntimeConfig } = await import('../src/lib/runtimeConfig');

        expect(serverRuntimeConfig.admin.emailAllowlist).toEqual([]);
        expect(serverRuntimeConfig.debug.enableLogs).toBe(false);
    });
});
