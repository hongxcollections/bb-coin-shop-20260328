import { useEffect } from "react";

interface SeoMeta {
  title?: string;
  description?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: "website" | "article";
}

const DEFAULT_TITLE = "hongxcollections｜香港專業錢幣拍賣";
const DEFAULT_DESC = "香港最具規模的錢幣網上拍賣平台，買賣古幣、紀念幣、評級幣，免費登記立即出價。";
const DEFAULT_IMAGE = "https://hongxcollections.com/og-default.jpg";
const SITE_NAME = "hongxcollections";

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

export function useSeoMeta({ title, description, ogImage, ogUrl, ogType = "website" }: SeoMeta = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const desc = description ?? DEFAULT_DESC;
    const image = ogImage ?? DEFAULT_IMAGE;
    const url = ogUrl ?? window.location.href;

    document.title = fullTitle;

    setMeta("description", desc, false);
    setMeta("og:title", fullTitle);
    setMeta("og:description", desc);
    setMeta("og:image", image);
    setMeta("og:url", url);
    setMeta("og:type", ogType);
    setMeta("og:site_name", SITE_NAME);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    setMeta("twitter:image", image);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESC, false);
      setMeta("og:title", DEFAULT_TITLE);
      setMeta("og:description", DEFAULT_DESC);
      setMeta("og:image", DEFAULT_IMAGE);
      setMeta("og:url", window.location.origin);
      setMeta("og:type", "website");
      setMeta("og:site_name", SITE_NAME);
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:title", DEFAULT_TITLE);
      setMeta("twitter:description", DEFAULT_DESC);
      setMeta("twitter:image", DEFAULT_IMAGE);
    };
  }, [title, description, ogImage, ogUrl, ogType]);
}
