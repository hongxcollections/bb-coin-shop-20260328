import { useEffect } from "react";

/**
 * Injects a JSON-LD <script> tag into <head> for structured data (Schema.org).
 * Automatically removes it when the component unmounts.
 * @param data  Plain JS object to serialise as JSON-LD. Pass `null` to skip.
 * @param id    Unique DOM id for the script tag (prevents duplicates).
 */
export function useJsonLd(data: Record<string, unknown> | null, id: string) {
  useEffect(() => {
    if (!data) return;
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      const tag = document.getElementById(id);
      if (tag) tag.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), id]);
}
