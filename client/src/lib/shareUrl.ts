export const SHARE_ORIGIN = "https://share.hongxcollections.com";

export function shareUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SHARE_ORIGIN}${cleanPath}`;
}
