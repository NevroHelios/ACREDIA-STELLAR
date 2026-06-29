import { getRuntimeConfig } from './runtimeConfig';

/*
 * TODO: Error Monitoring & Observability Implementation Plan
 * 
 * 1. SDK Integration:
 *    - Initialize Sentry (or equivalent) in `sentry.server.config.ts`, `sentry.client.config.ts`, and `sentry.edge.config.ts`.
 *    - Configure `beforeSend` callback to filter out sensitive credentials, authorization headers, or PII (e.g. user emails/addresses if requested).
 * 
 * 2. Structured API Logging & Request IDs:
 *    - Implement a middleware or api wrapper that generates a unique `x-request-id` header for each incoming HTTP request.
 *    - Export a `structuredLog` function that formats output as JSON containing:
 *      { timestamp, level, requestId, message, context }
 *    - Centralize all logging: route all direct console.* calls through the debug/structured logger, gated by env.
 *    - Ensure server and client logs never echo raw secrets, private keys, JWTs, or full auth tokens.
 * 
 * 3. Self-host / Opt-out Documentation:
 *    - Support env-var `NEXT_PUBLIC_DISABLE_TELEMETRY=true` or `SENTRY_DSN=""` to completely opt-out or redirect to a self-hosted instance.
 */

export function isDebugLoggingEnabled(): boolean {
    return process.env.NODE_ENV !== 'production' && getRuntimeConfig().debug.enableLogs;
}

export function debugLog(...args: unknown[]) {
    if (isDebugLoggingEnabled()) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}

export function debugWarn(...args: unknown[]) {
    if (isDebugLoggingEnabled()) {
        console.warn(...args);
    }
}
