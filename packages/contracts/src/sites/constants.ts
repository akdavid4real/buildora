export const RESERVED_SITE_SLUGS = [
  'admin',
  'api',
  'assets',
  'auth',
  'blog',
  'dashboard',
  'favicon',
  'login',
  'media',
  'pages',
  'posts',
  'public',
  'register',
  'robots',
  'settings',
  'site',
  'sitemap',
  'static',
  'themes',
  'user',
  'users',
] as const;

export type ReservedSiteSlug = (typeof RESERVED_SITE_SLUGS)[number];

export const THEME_IDS = ['minimal-blog', 'small-business', 'personal-portfolio'] as const;

export type ThemeId = (typeof THEME_IDS)[number];
