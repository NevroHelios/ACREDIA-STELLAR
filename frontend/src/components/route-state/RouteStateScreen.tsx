import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

interface RouteStateScreenProps {
    title: string;
    description: string;
    actionLabel?: string;
    secondaryActionLabel?: string;
    onAction?: () => void;
    onSecondaryAction?: () => void;
    variant?: 'error' | 'loading' | 'not-found';
}

export function RouteStateScreen({
    title,
    description,
    actionLabel,
    secondaryActionLabel,
    onAction,
    onSecondaryAction,
    variant = 'error',
}: RouteStateScreenProps) {
    const isLoading = variant === 'loading';

    return (
        <div className="flex min-h-screen items-center justify-center bg-app-wash px-4 py-12">
            <Card className="w-full max-w-xl p-8 text-center sm:p-10">
                <div className="flex flex-col items-center">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {isLoading ? (
                            <Loader2 className="h-8 w-8 animate-spin" />
                        ) : variant === 'not-found' ? (
                            <ShieldCheck className="h-8 w-8" />
                        ) : (
                            <AlertCircle className="h-8 w-8" />
                        )}
                    </div>
                    <p className="eyebrow mb-3">Acredia</p>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {title}
                    </h1>
                    <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
                        {description}
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        {actionLabel ? (
                            <Button onClick={onAction} size="lg">
                                {actionLabel}
                            </Button>
                        ) : null}
                        {secondaryActionLabel ? (
                            <Button variant="outline" size="lg" asChild onClick={onSecondaryAction}>
                                <Link href="/">{secondaryActionLabel}</Link>
                            </Button>
                        ) : null}
                    </div>
                </div>
            </Card>
        </div>
    );
}
