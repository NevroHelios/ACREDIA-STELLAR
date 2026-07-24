import { CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

interface VerificationStateCardProps {
    status: 'valid' | 'invalid' | 'revoked';
    title: string;
    description: string;
}

export function VerificationStateCard({ status, title, description }: VerificationStateCardProps) {
    const styles = {
        valid: {
            icon: CheckCircle2,
            iconClassName: 'text-success',
            wrapperClassName: 'border-success/25 bg-success/10',
        },
        invalid: {
            icon: AlertCircle,
            iconClassName: 'text-destructive',
            wrapperClassName: 'border-destructive/25 bg-destructive/10',
        },
        revoked: {
            icon: ShieldCheck,
            iconClassName: 'text-warning',
            wrapperClassName: 'border-warning/25 bg-warning/10',
        },
    } as const;

    const current = styles[status];
    const Icon = current.icon;

    return (
        <div className={`rounded-2xl border p-6 shadow-sm ${current.wrapperClassName}`}>
            <div className="flex items-start gap-3">
                <div className="rounded-full bg-white/80 p-2">
                    <Icon className={`h-6 w-6 ${current.iconClassName}`} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </div>
            </div>
        </div>
    );
}
