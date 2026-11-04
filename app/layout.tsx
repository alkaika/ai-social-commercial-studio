import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Social Commercial Studio (BYOK)',
  description: 'Make high-quality social commercials in minutes. Bring your own key — no subscription.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (Grammarly, LastPass,
          password managers) inject data-* attributes onto <body> before React
          hydrates — a benign, well-known false positive, not an app bug. */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}

