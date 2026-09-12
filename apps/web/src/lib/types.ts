export type ContentStatus = 'DRAFT' | 'PUBLISHED';

export interface PageItem {
  id: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  status: ContentStatus;
  content: string; // rich text HTML / formatted content
  contentJson?: Record<string, unknown> | null; // structured Tiptap JSON
  seoTitle?: string;
  seoDescription?: string;
  updatedAt: string;
}

export interface PostItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImageId?: string | null;
  coverImageUrl?: string | null;
  status: ContentStatus;
  content: string;
  contentJson?: Record<string, unknown> | null; // structured Tiptap JSON
  authorName: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string; // data URL or public URL
  createdAt: string;
}

export type ThemeId = 'minimal-blog' | 'small-business' | 'personal-portfolio';

export interface SiteSettings {
  siteName: string;
  siteSlug: string;
  tagline: string;
  themeId: ThemeId;
  accentColor: string;
  customDomain?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface DemoStoreState {
  version: number;
  site: SiteSettings;
  pages: PageItem[];
  posts: PostItem[];
  media: MediaItem[];
  selectedPageId: string;
  selectedPostId: string | null;
  activeNav: 'overview' | 'pages' | 'posts' | 'media' | 'appearance' | 'settings';
}
