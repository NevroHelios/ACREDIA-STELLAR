'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, CheckCircle2, GraduationCap, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/AuthShell';
import { cn } from '@/lib/utils';
import { resendVerificationEmail, signUp } from '@/lib/supabase';
import {
    buildAuthCallbackUrl,
    getErrorMessage,
    getPasswordRequirements,
    normalizeEmail,
    sanitizeAuthRedirect,
    validateRegistrationInput,
} from '@/lib/authFlow';

type UserRole = 'institution' | 'student';

function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const roleParam = searchParams.get('role');
    const nextRedirect = sanitizeAuthRedirect(searchParams.get('next'));

    const [role, setRole] = useState<UserRole>(
        roleParam === 'institution' ? 'institution' : 'student',
    );
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [confirmationEmail, setConfirmationEmail] = useState('');

    const passwordRequirements = getPasswordRequirements(password);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        const validationError = validateRegistrationInput({
            name,
            email,
            password,
            confirmPassword,
        });

        if (validationError) {
            setError(validationError);
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await signUp(email, password, {
                emailRedirectTo: buildAuthCallbackUrl('/auth/login', nextRedirect),
                data: {
                    name: name.trim(),
                    role,
                },
            });

            if (error) {
                setError(error.message);
                return;
            }

            if (data.session) {
                router.push(nextRedirect);
                return;
            }

            setConfirmationEmail(normalizeEmail(email));
            setPassword('');
            setConfirmPassword('');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'An error occurred during registration'));
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setError('');
        setMessage('');
        setResending(true);

        try {
            const { error } = await resendVerificationEmail(
                confirmationEmail,
                buildAuthCallbackUrl('/auth/login', nextRedirect),
            );

            if (error) {
                setError(error.message);
                return;
            }

            setMessage('Verification email sent again. Check your inbox for the latest link.');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Unable to resend verification email'));
        } finally {
            setResending(false);
        }
    };

    if (confirmationEmail) {
        return (
            <AuthShell title="Check your email" subtitle="One more step to activate your account.">
                <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                        <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <p className="mt-5 text-sm text-muted-foreground">
                        We sent a verification link to{' '}
                        <span className="font-semibold text-foreground">{confirmationEmail}</span>.
                        Confirm your email, then continue to Acredia.
                    </p>

                    {error && (
                        <div
                            className="mt-4 rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}
                    {message && (
                        <div
                            className="mt-4 rounded-lg border border-success/25 bg-success/8 px-4 py-3 text-sm text-success"
                            role="status"
                        >
                            {message}
                        </div>
                    )}

                    <div className="mt-6 space-y-3">
                        <Button
                            type="button"
                            size="lg"
                            disabled={resending}
                            onClick={handleResendVerification}
                            className="w-full"
                        >
                            {resending ? 'Sending…' : 'Resend verification email'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            onClick={() =>
                                router.push(
                                    `/auth/login?next=${encodeURIComponent(nextRedirect)}`,
                                )
                            }
                            className="w-full"
                        >
                            Go to sign in
                        </Button>
                    </div>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Create your account"
            subtitle="Join Acredia to issue, own, or verify credentials."
            footer={
                <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link
                        href={`/auth/login?next=${encodeURIComponent(nextRedirect)}`}
                        className="font-semibold text-primary hover:underline"
                    >
                        Sign in
                    </Link>
                </p>
            }
        >
            {/* Role selector */}
            <div className="mb-6">
                <Label className="mb-2 block">I am registering as</Label>
                <div className="grid grid-cols-2 gap-3">
                    {(
                        [
                            { value: 'institution', label: 'Institution', icon: Building2 },
                            { value: 'student', label: 'Student', icon: GraduationCap },
                        ] as const
                    ).map((option) => {
                        const active = role === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setRole(option.value)}
                                aria-pressed={active}
                                className={cn(
                                    'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all',
                                    active
                                        ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/15'
                                        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                                )}
                            >
                                <option.icon className="h-7 w-7" />
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="name">
                        {role === 'institution' ? 'Institution name' : 'Full name'}
                    </Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder={role === 'institution' ? 'Stellar University' : 'Jane Doe'}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoComplete="name"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        aria-describedby="password-requirements"
                    />
                    <ul id="password-requirements" className="mt-2 grid gap-1.5 text-sm">
                        {passwordRequirements.map((requirement) => (
                            <li
                                key={requirement.id}
                                className={cn(
                                    'flex items-center gap-2',
                                    requirement.isMet
                                        ? 'text-success'
                                        : 'text-muted-foreground',
                                )}
                            >
                                <CheckCircle2
                                    className={cn(
                                        'h-4 w-4',
                                        requirement.isMet ? 'text-success' : 'text-muted-foreground/40',
                                    )}
                                    aria-hidden="true"
                                />
                                <span>{requirement.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        aria-invalid={Boolean(confirmPassword) && password !== confirmPassword}
                    />
                </div>

                {error && (
                    <div
                        className="rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <Button type="submit" size="lg" disabled={loading} className="w-full">
                    {loading ? 'Creating account…' : 'Create account'}
                </Button>
            </form>
        </AuthShell>
    );
}

export default function RegisterPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-background">
                    <div className="text-muted-foreground">Loading…</div>
                </div>
            }
        >
            <RegisterForm />
        </Suspense>
    );
}
