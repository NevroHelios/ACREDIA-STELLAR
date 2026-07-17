import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Acredia - Blockchain Academic Credentials',
    description: 'Secure, tamper-proof academic credentials powered by blockchain',
    // Favicon/icons are provided by the file-based conventions in this directory
    // (src/app/favicon.ico and src/app/icon.png), so the browser's default
    // `/favicon.ico` request resolves on every route — including error pages.
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    <Providers>
                        {children}
                        <Toaster position="top-right" />
                    </Providers>
                </ThemeProvider>
            </body>
        </html>
    );
}
