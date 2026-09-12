import type { Response } from 'express';

export const REFRESH_COOKIE_NAME = 'buildora_refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * Sets the HttpOnly, SameSite=Lax, Secure-in-production refresh token cookie.
 */
export function setRefreshTokenCookie(
  res: Response,
  token: string,
  expiresInDays: number,
  isProduction: boolean,
): void {
  const maxAgeMs = expiresInDays * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
  });
}

/**
 * Clears the refresh token cookie.
 */
export function clearRefreshTokenCookie(res: Response, isProduction: boolean): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}
