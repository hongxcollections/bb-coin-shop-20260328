/**
 * serverCache.ts
 * 輕量 in-memory TTL cache，用於減少重複 MySQL 查詢。
 * 唔依賴任何外部套件，直接用 Map + setTimeout。
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * 取值；若不存在或已過期，執行 fetcher 並緩存結果。
 * @param key    緩存 key
 * @param ttlMs  有效期（毫秒）
 * @param fetcher 取資料的 async 函數
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    return entry.value;
  }
  const value = await fetcher();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** 主動讓某個 key 過期（資料被寫入時呼叫） */
export function invalidate(key: string): void {
  store.delete(key);
}

/** 讓所有符合前綴的 key 過期 */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
