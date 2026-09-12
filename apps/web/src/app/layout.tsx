import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buildora — AI-powered websites made simple',
  description: 'A lightweight CMS for beautiful small websites and blogs.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
