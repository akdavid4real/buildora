import React from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
import { DemoProvider } from '../../lib/demo-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <DashboardShell>{children}</DashboardShell>
    </DemoProvider>
  );
}
