'use client';

import { RouteStateScreen } from '@/components/route-state/RouteStateScreen';

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body>
                <RouteStateScreen
                    title="Acredia hit an unexpected issue"
                    description="The app encountered a problem. Please refresh the page or try again in a moment."
                    actionLabel="Try again"
                    secondaryActionLabel="Back to home"
                    onAction={props.reset}
                    variant="error"
                />
            </body>
        </html>
    );
}
