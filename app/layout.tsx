// @ts-ignore
import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/app/providers';
import { GlobalErrorBoundary } from '@/components/error-boundary';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pão e Leite · Gestão',
  description: 'Sistema de gestão da padaria Pão e Leite',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={jakarta.variable} suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground min-h-screen flex flex-col overflow-x-hidden antialiased">
        <GlobalErrorBoundary>
          <Providers>
            <main className="flex-1 flex flex-col w-full h-full">
              {children}
            </main>
            <Toaster />
          </Providers>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}