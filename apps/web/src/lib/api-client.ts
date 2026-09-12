import type {
  ConfirmMediaUploadDto,
  CreatePageDto,
  CreatePostDto,
  CreateSiteDto,
  LoginDto,
  LoginResponse,
  MediaAssetResponse,
  MediaListQuery,
  PageListQuery,
  PageResponse,
  PaginatedResponse,
  PostListQuery,
  PostResponse,
  PublicSiteResponse,
  RegisterDto,
  RegisterResponse,
  RequestMediaUploadDto,
  RequestMediaUploadResponse,
  SiteResponse,
  UpdateMediaAssetDto,
  UpdatePageDto,
  UpdatePostDto,
  UpdateSiteDto,
  UserResponse,
} from '@buildora/contracts';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: Date | string;
  updatedAt?: Date | string;
};

export const authStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('buildora_access_token');
  },
  setAccessToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('buildora_access_token', token);
  },
  clearAccessToken: (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('buildora_access_token');
  },
  getUser: (): AuthUser | null => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem('buildora_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  setUser: (user: AuthUser): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('buildora_user', JSON.stringify(user));
  },
  clearUser: (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('buildora_user');
  },
  hasToken: (): boolean => {
    if (typeof window === 'undefined') return false;
    return Boolean(sessionStorage.getItem('buildora_access_token'));
  },
};

function toQueryString(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(query)) {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, String(val));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = authStorage.getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network connection failed';
    throw new ApiError(`Unable to reach Buildora API at ${API_BASE_URL}: ${message}`, 0);
  }

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text().catch(() => null);
    }

    const errorObj = errorData as { message?: string | string[] } | null;
    const message =
      (errorObj && typeof errorObj === 'object' && errorObj.message
        ? Array.isArray(errorObj.message)
          ? errorObj.message.join(', ')
          : errorObj.message
        : null) || `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, errorData);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  async login(dto: LoginDto): Promise<LoginResponse> {
    const data = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    authStorage.setAccessToken(data.accessToken);
    if (data.user) {
      authStorage.setUser(data.user);
    }
    return data;
  },

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const data = await apiFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    authStorage.setAccessToken(data.accessToken);
    if (data.user) {
      authStorage.setUser(data.user);
    }
    return data;
  },

  async getMe(): Promise<UserResponse> {
    const data = await apiFetch<UserResponse>('/auth/me', {
      method: 'GET',
    });
    authStorage.setUser(data);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<{ message: string }>('/auth/logout', {
        method: 'POST',
      });
    } finally {
      authStorage.clearAccessToken();
      authStorage.clearUser();
    }
  },
};

export const sitesApi = {
  async list(): Promise<SiteResponse[]> {
    return apiFetch<SiteResponse[]>('/sites');
  },
  async get(siteId: string): Promise<SiteResponse> {
    return apiFetch<SiteResponse>(`/sites/${siteId}`);
  },
  async create(dto: CreateSiteDto): Promise<SiteResponse> {
    return apiFetch<SiteResponse>('/sites', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
  async update(siteId: string, dto: UpdateSiteDto): Promise<SiteResponse> {
    return apiFetch<SiteResponse>(`/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },
};

export const pagesApi = {
  async list(siteId: string, query?: PageListQuery): Promise<PaginatedResponse<PageResponse>> {
    return apiFetch<PaginatedResponse<PageResponse>>(
      `/sites/${siteId}/pages${toQueryString(query)}`,
    );
  },
  async get(siteId: string, pageId: string): Promise<PageResponse> {
    return apiFetch<PageResponse>(`/sites/${siteId}/pages/${pageId}`);
  },
  async create(siteId: string, dto: CreatePageDto): Promise<PageResponse> {
    return apiFetch<PageResponse>(`/sites/${siteId}/pages`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
  async update(siteId: string, pageId: string, dto: UpdatePageDto): Promise<PageResponse> {
    return apiFetch<PageResponse>(`/sites/${siteId}/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },
  async delete(siteId: string, pageId: string): Promise<void> {
    return apiFetch<void>(`/sites/${siteId}/pages/${pageId}`, {
      method: 'DELETE',
    });
  },
  async publish(siteId: string, pageId: string): Promise<PageResponse> {
    return apiFetch<PageResponse>(`/sites/${siteId}/pages/${pageId}/publish`, {
      method: 'POST',
    });
  },
  async unpublish(siteId: string, pageId: string): Promise<PageResponse> {
    return apiFetch<PageResponse>(`/sites/${siteId}/pages/${pageId}/unpublish`, {
      method: 'POST',
    });
  },
};

export const postsApi = {
  async list(siteId: string, query?: PostListQuery): Promise<PaginatedResponse<PostResponse>> {
    return apiFetch<PaginatedResponse<PostResponse>>(
      `/sites/${siteId}/posts${toQueryString(query)}`,
    );
  },
  async get(siteId: string, postId: string): Promise<PostResponse> {
    return apiFetch<PostResponse>(`/sites/${siteId}/posts/${postId}`);
  },
  async create(siteId: string, dto: CreatePostDto): Promise<PostResponse> {
    return apiFetch<PostResponse>(`/sites/${siteId}/posts`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
  async update(siteId: string, postId: string, dto: UpdatePostDto): Promise<PostResponse> {
    return apiFetch<PostResponse>(`/sites/${siteId}/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },
  async delete(siteId: string, postId: string): Promise<void> {
    return apiFetch<void>(`/sites/${siteId}/posts/${postId}`, {
      method: 'DELETE',
    });
  },
  async publish(siteId: string, postId: string): Promise<PostResponse> {
    return apiFetch<PostResponse>(`/sites/${siteId}/posts/${postId}/publish`, {
      method: 'POST',
    });
  },
  async unpublish(siteId: string, postId: string): Promise<PostResponse> {
    return apiFetch<PostResponse>(`/sites/${siteId}/posts/${postId}/unpublish`, {
      method: 'POST',
    });
  },
};

export const mediaApi = {
  async list(
    siteId: string,
    query?: MediaListQuery,
  ): Promise<PaginatedResponse<MediaAssetResponse>> {
    return apiFetch<PaginatedResponse<MediaAssetResponse>>(
      `/sites/${siteId}/media${toQueryString(query)}`,
    );
  },
  async requestUpload(
    siteId: string,
    dto: RequestMediaUploadDto,
  ): Promise<RequestMediaUploadResponse> {
    return apiFetch<RequestMediaUploadResponse>(`/sites/${siteId}/media/upload-request`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
  async confirmUpload(siteId: string, dto: ConfirmMediaUploadDto): Promise<MediaAssetResponse> {
    return apiFetch<MediaAssetResponse>(`/sites/${siteId}/media/confirm`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
  async update(
    siteId: string,
    mediaId: string,
    dto: UpdateMediaAssetDto,
  ): Promise<MediaAssetResponse> {
    return apiFetch<MediaAssetResponse>(`/sites/${siteId}/media/${mediaId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },
  async delete(siteId: string, mediaId: string): Promise<void> {
    return apiFetch<void>(`/sites/${siteId}/media/${mediaId}`, {
      method: 'DELETE',
    });
  },
};

export const publicApi = {
  async getSiteBySlug(slug: string): Promise<PublicSiteResponse> {
    return apiFetch<PublicSiteResponse>(`/public/sites/${encodeURIComponent(slug)}`);
  },
};
