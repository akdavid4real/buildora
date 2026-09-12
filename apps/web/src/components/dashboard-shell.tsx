'use client';

import {
  AlertCircle,
  BookOpen,
  Check,
  Eye,
  FileText,
  FormInput,
  Globe2,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Plug,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useDemo } from '../lib/demo-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/sites', label: 'Websites', icon: Globe2 },
  { href: '/dashboard/pages', label: 'Pages', icon: FileText },
  { href: '/dashboard/posts', label: 'Blog posts', icon: BookOpen },
  { href: '/dashboard/media', label: 'Media', icon: ImageIcon },
  { href: '/dashboard/forms', label: 'Forms', icon: FormInput },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
  { href: '/dashboard/appearance', label: 'Appearance', icon: Palette },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    state,
    hydrated,
    notice,
    isApiMode,
    loading,
    apiError,
    currentUser,
    resetDemo,
    refreshData,
    setMode,
    logout,
  } = useDemo();
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!hydrated) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f5' }}>
        <p style={{ color: '#6f7c77', fontWeight: 600 }}>Loading Buildora...</p>
      </div>
    );
  }

  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Overview';
    if (pathname.startsWith('/dashboard/sites')) return 'Websites';
    if (pathname.startsWith('/dashboard/pages')) return 'Pages';
    if (pathname.startsWith('/dashboard/posts')) return 'Blog posts';
    if (pathname.startsWith('/dashboard/media')) return 'Media';
    if (pathname.startsWith('/dashboard/forms')) return 'Forms';
    if (pathname.startsWith('/dashboard/integrations')) return 'Integrations';
    if (pathname.startsWith('/dashboard/appearance')) return 'Appearance';
    if (pathname.startsWith('/dashboard/settings')) return 'Settings';
    return 'Dashboard';
  };

  const isNavActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : currentUser?.email
      ? currentUser.email.slice(0, 2).toUpperCase()
      : 'AK';

  return (
    <div className="app">
      <div className={`sidebar-overlay ${menu ? 'open' : ''}`} onClick={() => setMenu(false)} aria-label="Close sidebar" />
      <aside className={`sidebar ${menu ? 'open' : ''}`} aria-label="Main sidebar navigation">
        <div className="sidebar-header">
          <div className="brand"><span className="brand-mark">B</span> Buildora</div>
          <button className="sidebar-close" aria-label="Close sidebar" onClick={() => setMenu(false)}><X size={18} /></button>
        </div>
        <div className="site-switch">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small>Current website</small>
            <span className={`badge ${!isApiMode ? 'draft' : ''}`} style={{ fontSize: 10, padding: '2px 6px', background: isApiMode ? '#2a6a57' : '#ffffff20', color: 'white' }}>
              {isApiMode ? 'API' : 'Demo'}
            </span>
          </div>
          <strong>{state.site.siteName}</strong>
        </div>
        <nav className="nav" aria-label="Dashboard navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(href);
            return (
              <Link key={href} href={href} className={active ? 'active' : ''} onClick={() => setMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9, textDecoration: 'none', color: active ? 'white' : '#b9ccc5', background: active ? '#ffffff13' : 'transparent' }}>
                <Icon size={16} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <a href={`/site/${state.site.siteSlug}`} target="_blank" rel="noopener noreferrer">
            <Globe2 size={14} style={{ display: 'inline', marginRight: 8 }} /> View live website
          </a>

          {isApiMode ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <button className="btn btn-soft" onClick={() => { setMode('demo'); router.push('/dashboard'); }} style={{ fontSize: 13, padding: '8px 10px' }}>
                <Sparkles size={14} /> Switch to demo
              </button>
              <button className="btn btn-secondary" onClick={async () => { await logout(); router.push('/'); }} style={{ fontSize: 13, padding: '8px 10px', background: 'transparent', color: '#f6dada', borderColor: '#ffffff22' }}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              <button className="btn btn-soft" onClick={() => { resetDemo(); router.push('/dashboard'); }} style={{ fontSize: 13, padding: '8px 10px' }}>
                <RotateCcw size={14} /> Reset demo
              </button>
              <Link href="/" className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 10px', textDecoration: 'none', background: 'transparent', color: '#c9ddd5', borderColor: '#ffffff22' }}>
                <Sparkles size={14} /> Connect API / Login
              </Link>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="mobile-menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu(!menu)}>
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1>{getPageTitle()}</h1>
          </div>
          <div className="top-actions">
            <span className={`badge ${!isApiMode ? 'draft' : ''}`} style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i className={`dot ${isApiMode ? 'live' : ''}`} /> {isApiMode ? 'API Mode' : 'Offline Demo'}
            </span>
            <a className="btn btn-secondary" href={`/site/${state.site.siteSlug}`} target="_blank" rel="noopener noreferrer">
              <Eye size={16} /><span>View site</span>
            </a>
            <span className="avatar" title={currentUser?.email || (isApiMode ? 'API User' : 'Demo User')}>{initials}</span>
          </div>
        </header>

        {apiError && (
          <div style={{ padding: '10px 24px', background: '#fff3f3', borderBottom: '1px solid #f8d7da', color: '#842029', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span><strong>API connection notice:</strong> {apiError} (fallback data loaded)</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => refreshData()} disabled={loading}>
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Retry API
              </button>
              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setMode('demo')}>Use demo mode</button>
            </div>
          </div>
        )}

        {children}
      </main>

      {notice && <div className="notice"><Check size={15} style={{ display: 'inline', marginRight: 8 }} />{notice}</div>}
    </div>
  );
}
