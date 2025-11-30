import { QueryClient, QueryFunction } from "@tanstack/react-query";
import baselineData from "./baseline-data.json";

const DATA_CACHE_NAME = 'iccat-data-v7';

// Global request counter for kiosk uptime tracking
export const requestCounter = {
  total: 0,
  successful: 0,
  recordSuccess: () => {
    requestCounter.total++;
    requestCounter.successful++;
  },
  recordFailure: () => {
    requestCounter.total++;
  },
  reset: () => {
    requestCounter.total = 0;
    requestCounter.successful = 0;
  }
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

const networkFirstQueryFn: QueryFunction = async ({ queryKey }) => {
  const url = queryKey.join("/") as string;
  
  try {
    const res = await fetch(url, { 
      credentials: "include",
      cache: 'no-cache'
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[QUERY] Network-first: Fetched fresh ${url} from server`);
      requestCounter.recordSuccess();
      
      // Update CacheStorage with fresh data when network fetch succeeds
      if (window.caches) {
        try {
          const cache = await window.caches.open(DATA_CACHE_NAME);
          const responseToCache = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
          });
          await cache.put(url, responseToCache);
        } catch (cacheError) {
          console.error(`[QUERY] Failed to update CacheStorage for ${url}:`, cacheError);
        }
      }
      
      return data;
    }
  } catch (fetchError) {
    console.log(`[QUERY] Network failed for ${url}, falling back to cache...`);
  }

  if (window.caches) {
    try {
      const cache = await window.caches.open(DATA_CACHE_NAME);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        console.log(`[QUERY] Retrieved ${url} from CacheStorage (offline)`);
        requestCounter.recordSuccess();
        return await cachedResponse.json();
      }
    } catch (cacheError) {
      console.error(`[QUERY] CacheStorage error for ${url}:`, cacheError);
    }
  }

  const dataKey = url.replace('/api/', '') as keyof typeof baselineData;
  if (dataKey in baselineData) {
    console.log(`[QUERY] Using embedded baseline data for ${dataKey}`);
    requestCounter.recordSuccess();
    return baselineData[dataKey];
  }

  requestCounter.recordFailure();
  throw new Error(`No offline data available for ${url}`);
};

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        requestCounter.recordSuccess(); // 401 is expected behavior, not a failure
        return null;
      }

      await throwIfResNotOk(res);
      requestCounter.recordSuccess();
      return await res.json();
    } catch (error) {
      requestCounter.recordFailure();
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: networkFirstQueryFn,
      // FIREBASE READ OPTIMIZATION: Listeners + Network-First Strategy
      // Architecture: Listeners broadcast changes → Cache updated → Reduce network calls
      // Cost: ~1-5K reads/day (vs 100K with polling) = 99% savings
      
      // NO polling - listeners handle all updates
      refetchInterval: false, // DISABLED: Listeners broadcast all changes
      refetchIntervalInBackground: false,
      
      // NO window focus refetch - listeners keep cache fresh
      // Only refetch if data is stale AND we're actually mounted
      refetchOnWindowFocus: false, // DISABLED: Listeners handle updates
      
      // YES refetch on reconnect - syncs when network comes back
      refetchOnReconnect: true, // ENABLED: Sync latest when reconnecting
      
      // Long stale time - listeners keep data fresh
      // Only refetch if data is older than 5 minutes AND component requests it
      staleTime: 5 * 60 * 1000, // 5 minutes: Listeners keep cache fresh
      
      // Single retry on network failure
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
