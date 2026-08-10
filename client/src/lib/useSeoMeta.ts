import { useEffect } from "react";

interface SeoMeta {
  title?: string;
  description?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: "website" | "article";
}

const PROD_ORIGIN = "https://hongxcollections.com";
const DEFAULT_TITLE = "hongxcollections.com | 錢幣 · 競投 · 即時成交";
const DEFAULT_DESC = "香港最具規模的錢幣網上拍賣平台，買賣古幣、紀念幣、評級幣，免費登記立即出價。";
const DEFAULT_IMAGE = `${PROD_ORIGIN}/og-default.jpg`;
const SITE_NAME = "hongxcollections";

/** Always returns a canonical URL on the production origin, regardless of which domain the page is viewed on. */
function toCanonical(path?: string): string {
  if (path) {
    // If caller already passed a full production URL, use it as-is
    if (path.startsWith(PROD_ORIGIN)) return path;
    // Strip any other origin prefix and re-attach production origin
    try {
      const u = new URL(path);
      return `${PROD_ORIGIN}${u.pathname}${u.search}`;
    } catch {
      return `${PROD_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
    }
  }
  // Fallback: use current pathname on production origin
  return `${PROD_ORIGIN}${window.location.pathname}${window.location.search}`;
}

function setMeta(property: string, content: string, useProperty = true) {
  const attr = useProperty ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function removeCanonical() {
  const el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (el) el.remove();
}

export function useSeoMeta({ title, description, ogImage, ogUrl, ogType = "website" }: SeoMeta = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const desc = description ?? DEFAULT_DESC;
    const image = ogImage ?? DEFAULT_IMAGE;
    const canonical = toCanonical(ogUrl);

    document.title = fullTitle;

    setMeta("description", desc, false);
    setMeta("og:title", fullTitle);
    setMeta("og:description", desc);
    setMeta("og:image", image);
    setMeta("og:url", canonical);
    setMeta("og:type", ogType);
    setMeta("og:site_name", SITE_NAME);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    setMeta("twitter:image", image);
    setCanonical(canonical);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESC, false);
      setMeta("og:title", DEFAULT_TITLE);
      setMeta("og:description", DEFAULT_DESC);
      setMeta("og:image", DEFAULT_IMAGE);
      setMeta("og:url", PROD_ORIGIN);
      setMeta("og:type", "website");
      setMeta("og:site_name", SITE_NAME);
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:title", DEFAULT_TITLE);
      setMeta("twitter:description", DEFAULT_DESC);
      setMeta("twitter:image", DEFAULT_IMAGE);
      removeCanonical();
    };
  }, [title, description, ogImage, ogUrl, ogType]);
}
