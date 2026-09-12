'use client';

import type {
  MediaAssetResponse,
  PageResponse,
  PaginatedResponse,
  PostResponse,
  SiteResponse,
  ThemeId,
  TiptapDoc,
  UpdatePageDto,
  UpdatePostDto,
} from '@buildora/contracts';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type AuthUser,
  authApi,
  authStorage,
  mediaApi,
  pagesApi,
  postsApi,
  sitesApi,
} from './api-client';
import { DemoStore, INITIAL_DEMO_STATE } from './demo-store';
import type { DemoStoreState, MediaItem, PageItem, PostItem } from './types';

export type AppMode = 'api' | 'demo';

interface DemoContextValue {
  state: DemoStoreState;
  hydrated: boolean;
  entered: boolean;
  mode: AppMode;
  isApiMode: boolean;
  loading: boolean;
  apiError: string | null;
  currentUser: AuthUser | null;
  currentSite: SiteResponse | null;
  sites: SiteResponse[];
  notice: string;
  setEntered: (val: boolean) => void;
  setMode: (mode: AppMode) => void;
  showNotice: (msg: string) => void;
  updateState: (next: DemoStoreState, message?: string) => void;
  patchPage: (id: string, patch: Partial<PageItem>, message?: string) => Promise<void>;
  patchPost: (id: string, patch: Partial<PostItem>, message?: string) => Promise<void>;
  createPage: () => Promise<string>;
  createPost: () => Promise<string>;
  deletePage: (id: string, message?: string) => Promise<void>;
  deletePost: (id: string, message?: string) => Promise<void>;
  resetDemo: () => void;
  refreshData: () => Promise<void>;
  logout: () => Promise<void>;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const cloneInitial = () => JSON.parse(JSON.stringify(INITIAL_DEMO_STATE)) as DemoStoreState;

const emptyPaginationMeta = {
  total: 0,
  page: 1,
  limit: 100,
  totalPages: 0,
};

function generateSlugSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

function mapPageResponse(p: PageResponse): PageItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    isHomepage: p.isHomepage,
    status: p.status,
    content: '',
    contentJson: p.contentJson as Record<string, unknown>,
    seoTitle: p.seoTitle ?? undefined,
    seoDescription: p.seoDescription ?? undefined,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString(),
  };
}

function mapPostResponse(p: PostResponse): PostItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? undefined,
    coverImageId: p.coverImageId,
    coverImageUrl: p.coverImageUrl,
    status: p.status,
    content: '',
    contentJson: p.contentJson as Record<string, unknown>,
    authorName: 'Alex Rivera',
    tags: [],
    seoTitle: p.seoTitle ?? undefined,
    seoDescription: p.seoDescription ?? undefined,
    publishedAt: p.publishedAt
      ? typeof p.publishedAt === 'string'
        ? p.publishedAt
        : new Date(p.publishedAt).toISOString()
      : null,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString(),
  };
}

function mapMediaResponse(m: MediaAssetResponse): MediaItem {
  return {
    id: m.id,
    name: m.originalFilename || m.filename,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    url: m.publicUrl,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
  };
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoStoreState>(cloneInitial);
  const [hydrated, setHydrated] = useState(false);
  const [entered, setEnteredState] = useState(false);
  const [mode, setModeState] = useState<AppMode>('demo');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentSite, setCurrentSite] = useState<SiteResponse | null>(null);
  const [sites, setSites] = useState<SiteResponse[]>([]);
  const [notice, setNotice] = useState('');

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3000);
  }, []);

  const isApiMode = mode === 'api';

  // Load API data for the authenticated user and active site
  const loadApiData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      // 1. Fetch user & sites
      const user = authStorage.getUser();
      if (user) setCurrentUser(user);

      let fetchedSites = await sitesApi.list();
      if (!fetchedSites || fetchedSites.length === 0) {
        // Automatically create a default site if user doesn't have one with collision-resistant slug
        const uniqueSlug = `site-${generateSlugSuffix()}`;
        const newSite = await sitesApi.create({
          name: 'My Buildora Site',
          slug: uniqueSlug,
          themeId: 'minimal-blog',
          themeConfig: {
            tagline: 'Modern publishing powered by Buildora',
            accentColor: '#174d3e',
          },
        });
        fetchedSites = [newSite];
      }

      setSites(fetchedSites);
      const activeSite = fetchedSites[0];
      setCurrentSite(activeSite);

      // 2. Fetch pages, posts, and media in parallel
      const [pagesRes, postsRes, mediaRes] = await Promise.all([
        pagesApi
          .list(activeSite.id, { page: 1, limit: 100 })
          .catch((): PaginatedResponse<PageResponse> => ({ data: [], meta: emptyPaginationMeta })),
        postsApi
          .list(activeSite.id, { page: 1, limit: 100 })
          .catch((): PaginatedResponse<PostResponse> => ({ data: [], meta: emptyPaginationMeta })),
        mediaApi
          .list(activeSite.id, { page: 1, limit: 100 })
          .catch((): PaginatedResponse<MediaAssetResponse> => ({
            data: [],
            meta: emptyPaginationMeta,
          })),
      ]);

      const mappedPages = pagesRes.data.map(mapPageResponse);
      const mappedPosts = postsRes.data.map(mapPostResponse);
      const mappedMedia = mediaRes.data.map(mapMediaResponse);

      const themeConfig = (activeSite.themeConfig || {}) as Record<string, string | undefined>;

      setState((prev) => ({
        ...prev,
        site: {
          siteName: activeSite.name,
          siteSlug: activeSite.slug,
          tagline: themeConfig.tagline ?? 'Modern publishing platform',
          themeId: (activeSite.themeId as ThemeId) || 'minimal-blog',
          accentColor: themeConfig.accentColor ?? '#174d3e',
          customDomain: themeConfig.customDomain,
          seoTitle: themeConfig.seoTitle,
          seoDescription: themeConfig.seoDescription,
        },
        pages: mappedPages,
        posts: mappedPosts,
        media: mappedMedia,
        selectedPageId: mappedPages[0]?.id ?? '',
        selectedPostId: mappedPosts[0]?.id ?? null,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to API backend';
      setApiError(msg);
      showNotice(`API Notice: ${msg} (using local store)`);
      // Fallback to local demo store on API error
      setState(DemoStore.getState());
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  const setMode = useCallback(
    (nextMode: AppMode) => {
      setModeState(nextMode);
      if (nextMode === 'api') {
        if (authStorage.hasToken()) {
          loadApiData();
        } else {
          setApiError('No active API session token found. Please sign in.');
          setModeState('demo');
          setState(DemoStore.getState());
        }
      } else {
        setApiError(null);
        setState(DemoStore.getState());
      }
    },
    [loadApiData],
  );

  useEffect(() => {
    const hasToken = authStorage.hasToken();
    const isEntered = sessionStorage.getItem('buildora-entered') === 'yes';
    setEnteredState(isEntered);

    if (hasToken) {
      setModeState('api');
      loadApiData();
    } else {
      setModeState('demo');
      setState(DemoStore.getState());
    }
    setHydrated(true);
  }, [loadApiData]);

  const setEntered = (val: boolean) => {
    if (val) {
      sessionStorage.setItem('buildora-entered', 'yes');
    } else {
      sessionStorage.removeItem('buildora-entered');
    }
    setEnteredState(val);
  };

  const updateState = (next: DemoStoreState, message?: string) => {
    setState(next);
    if (!isApiMode) {
      DemoStore.saveState(next);
    } else if (currentSite) {
      // Sync site settings changes to API if in API mode
      sitesApi
        .update(currentSite.id, {
          name: next.site.siteName,
          slug: next.site.siteSlug,
          themeId: next.site.themeId,
          themeConfig: {
            tagline: next.site.tagline,
            accentColor: next.site.accentColor,
            customDomain: next.site.customDomain,
            seoTitle: next.site.seoTitle,
            seoDescription: next.site.seoDescription,
          },
        })
        .catch((err) => {
          showNotice(`Site sync error: ${err.message}`);
        });
    }
    if (message) {
      showNotice(message);
    }
  };

  const patchPage = async (id: string, patch: Partial<PageItem>, message?: string) => {
    // 1. Optimistic state update
    setState((prev) => {
      const nextPages = prev.pages.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      );
      const nextState = { ...prev, pages: nextPages };
      if (!isApiMode) {
        DemoStore.saveState(nextState);
      }
      return nextState;
    });

    if (message) showNotice(message);

    // 2. If in API mode, persist to backend
    if (isApiMode && currentSite) {
      try {
        if (patch.status === 'PUBLISHED') {
          await pagesApi.publish(currentSite.id, id);
        } else if (patch.status === 'DRAFT') {
          await pagesApi.unpublish(currentSite.id, id);
        }

        const updateDto: UpdatePageDto = {};
        if (patch.title !== undefined) updateDto.title = patch.title;
        if (patch.slug !== undefined) updateDto.slug = patch.slug;
        if (patch.isHomepage !== undefined) updateDto.isHomepage = patch.isHomepage;
        if (patch.contentJson !== undefined && patch.contentJson !== null) {
          updateDto.contentJson = patch.contentJson as TiptapDoc;
        }
        if (patch.seoTitle !== undefined) updateDto.seoTitle = patch.seoTitle;
        if (patch.seoDescription !== undefined) updateDto.seoDescription = patch.seoDescription;

        if (Object.keys(updateDto).length > 0) {
          await pagesApi.update(currentSite.id, id, updateDto);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update page on server';
        showNotice(`API Sync Notice: ${msg}`);
      }
    }
  };

  const patchPost = async (id: string, patch: Partial<PostItem>, message?: string) => {
    // 1. Optimistic state update
    setState((prev) => {
      const nextPosts = prev.posts.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      );
      const nextState = { ...prev, posts: nextPosts };
      if (!isApiMode) {
        DemoStore.saveState(nextState);
      }
      return nextState;
    });

    if (message) showNotice(message);

    // 2. If in API mode, persist to backend
    if (isApiMode && currentSite) {
      try {
        if (patch.status === 'PUBLISHED') {
          await postsApi.publish(currentSite.id, id);
        } else if (patch.status === 'DRAFT') {
          await postsApi.unpublish(currentSite.id, id);
        }

        const updateDto: UpdatePostDto = {};
        if (patch.title !== undefined) updateDto.title = patch.title;
        if (patch.slug !== undefined) updateDto.slug = patch.slug;
        if (patch.excerpt !== undefined) updateDto.excerpt = patch.excerpt;
        if (patch.coverImageId !== undefined) updateDto.coverImageId = patch.coverImageId;
        if (patch.contentJson !== undefined && patch.contentJson !== null) {
          updateDto.contentJson = patch.contentJson as TiptapDoc;
        }
        if (patch.seoTitle !== undefined) updateDto.seoTitle = patch.seoTitle;
        if (patch.seoDescription !== undefined) updateDto.seoDescription = patch.seoDescription;

        if (Object.keys(updateDto).length > 0) {
          await postsApi.update(currentSite.id, id, updateDto);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update post on server';
        showNotice(`API Sync Notice: ${msg}`);
      }
    }
  };

  const createPage = async (): Promise<string> => {
    const slugSuffix = generateSlugSuffix();
    const tempSlug = `page-${slugSuffix}`;

    if (isApiMode) {
      if (!currentSite) {
        const errorMsg = 'No active site available to create page';
        showNotice(errorMsg);
        throw new Error(errorMsg);
      }
      try {
        const created = await pagesApi.create(currentSite.id, {
          title: 'Untitled page',
          slug: tempSlug,
          status: 'DRAFT',
          isHomepage: false,
          contentJson: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Start writing something wonderful here.' }],
              },
            ],
          },
        });
        const mapped = mapPageResponse(created);
        setState((prev) => ({
          ...prev,
          pages: [mapped, ...prev.pages],
          selectedPageId: mapped.id,
        }));
        showNotice('New page created via API');
        return mapped.id;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'API page creation failed';
        showNotice(`Error creating page on API: ${msg}`);
        throw err;
      }
    }

    // Demo store creation (only when in demo mode)
    const id = `page-${Date.now()}`;
    const newPage: PageItem = {
      id,
      title: 'Untitled page',
      slug: tempSlug,
      isHomepage: false,
      status: 'DRAFT',
      content: '<h1>Untitled page</h1><p>Start writing something wonderful here.</p>',
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Start writing something wonderful here.' }],
          },
        ],
      },
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => {
      const next = { ...prev, pages: [newPage, ...prev.pages], selectedPageId: id };
      DemoStore.saveState(next);
      return next;
    });
    showNotice('New page created');
    return id;
  };

  const createPost = async (): Promise<string> => {
    const slugSuffix = generateSlugSuffix();
    const tempSlug = `post-${slugSuffix}`;

    if (isApiMode) {
      if (!currentSite) {
        const errorMsg = 'No active site available to create post';
        showNotice(errorMsg);
        throw new Error(errorMsg);
      }
      try {
        const created = await postsApi.create(currentSite.id, {
          title: 'Untitled post',
          slug: tempSlug,
          status: 'DRAFT',
          contentJson: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Write your new blog post here.' }],
              },
            ],
          },
        });
        const mapped = mapPostResponse(created);
        setState((prev) => ({
          ...prev,
          posts: [mapped, ...prev.posts],
          selectedPostId: mapped.id,
        }));
        showNotice('New blog post created via API');
        return mapped.id;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'API post creation failed';
        showNotice(`Error creating post on API: ${msg}`);
        throw err;
      }
    }

    // Demo store creation (only when in demo mode)
    const id = `post-${Date.now()}`;
    const newPost: PostItem = {
      id,
      title: 'Untitled post',
      slug: tempSlug,
      status: 'DRAFT',
      content: '<h1>Untitled story</h1><p>Write your new blog post here.</p>',
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Write your new blog post here.' }],
          },
        ],
      },
      authorName: currentUser?.name || 'Alex Rivera',
      tags: [],
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => {
      const next = { ...prev, posts: [newPost, ...prev.posts], selectedPostId: id };
      DemoStore.saveState(next);
      return next;
    });
    showNotice('New blog post created');
    return id;
  };

  const deletePage = async (id: string, message = 'Page removed') => {
    setState((prev) => {
      const nextPages = prev.pages.filter((p) => p.id !== id);
      const next = { ...prev, pages: nextPages };
      if (!isApiMode) DemoStore.saveState(next);
      return next;
    });
    showNotice(message);

    if (isApiMode && currentSite) {
      try {
        await pagesApi.delete(currentSite.id, id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete page on server';
        showNotice(`API Delete Notice: ${msg}`);
      }
    }
  };

  const deletePost = async (id: string, message = 'Post removed') => {
    setState((prev) => {
      const nextPosts = prev.posts.filter((p) => p.id !== id);
      const next = { ...prev, posts: nextPosts };
      if (!isApiMode) DemoStore.saveState(next);
      return next;
    });
    showNotice(message);

    if (isApiMode && currentSite) {
      try {
        await postsApi.delete(currentSite.id, id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete post on server';
        showNotice(`API Delete Notice: ${msg}`);
      }
    }
  };

  const resetDemo = () => {
    const fresh = DemoStore.resetToDefault();
    setState(fresh);
    showNotice('Demo content restored to default');
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout network errors and clear local session
      authStorage.clearAccessToken();
      authStorage.clearUser();
    }
    setModeState('demo');
    setEnteredState(false);
  };

  return (
    <DemoContext.Provider
      value={{
        state,
        hydrated,
        entered,
        mode,
        isApiMode,
        loading,
        apiError,
        currentUser,
        currentSite,
        sites,
        notice,
        setEntered,
        setMode,
        showNotice,
        updateState,
        patchPage,
        patchPost,
        createPage,
        createPost,
        deletePage,
        deletePost,
        resetDemo,
        refreshData: loadApiData,
        logout,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return ctx;
}
