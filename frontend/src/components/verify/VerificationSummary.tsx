import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Award } from 'lucide-react';

interface VerificationSummaryProps {
    status: 'valid' | 'revoked' | null;
}

export function VerificationSummary({ status }: VerificationSummaryProps) {
    if (status !== 'valid') {
        return null;
    }

    return (
        <div className="flex flex-wrap justify-center gap-3">
            <Badge className="bg-success/10 px-4 py-2 text-sm text-success hover:bg-success/10">
                <Shield className="mr-2 h-4 w-4" />
                Blockchain Verified
            </Badge>
            <Badge className="bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/10">
                <Lock className="mr-2 h-4 w-4" />
                Tamper-Proof
            </Badge>
            <Badge className="bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/10">
                <Award className="mr-2 h-4 w-4" />
                Authentic
            </Badge>
        </div>
    );
}
