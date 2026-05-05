export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// ─── 暫時停用：所有電郵 / Google OAuth 註冊入口 ──────────────────────────────
// 現階段網站只接受手機號碼註冊；登入入口統一去 /login 頁面（手機表單）
// 若需重新啟用 Google OAuth，將 GOOGLE_LOGIN_ENABLED 改為 true，
// 並同步更新 server/_core/oauth.ts 的 GOOGLE_OAUTH_NEW_USER_ENABLED
const GOOGLE_LOGIN_ENABLED = false;

export const getLoginUrl = (returnPath?: string) => {
  // 全部入口統一去 /login（手機表單）
  if (!GOOGLE_LOGIN_ENABLED) {
    const params = returnPath ? `?return=${encodeURIComponent(returnPath)}` : '';
    return `/login${params}`;
  }

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  // Use Google OAuth if Google Client ID is configured
  if (googleClientId && googleClientId.trim() !== '') {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', googleClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'online');
    if (returnPath) {
      url.searchParams.set('state', btoa(returnPath));
    }
    return url.toString();
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined;
  const appId = import.meta.env.VITE_APP_ID;

  // In sandbox/dev mode without a valid OAuth portal, use the dev login page
  if (!oauthPortalUrl || oauthPortalUrl.trim() === '' || oauthPortalUrl.includes('oauth.manus.im')) {
    return '/api/dev/login-page';
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
