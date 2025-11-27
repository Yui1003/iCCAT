import { QueryClient, QueryFunction } from "@tanstack/react-query";
import baselineData from "./baseline-data.json";

const DATA_CACHE_NAME = 'iccat-data-v6';

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
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: networkFirstQueryFn,
      // PRODUCTION OPTIMIZATION: 5-minute interval to minimize Firebase read costs
      // For kiosk: Queries auto-refetch only on window focus or reconnect
      // For mobile: Users navigate between pages, triggering fresh fetches naturally
      refetchInterval: 5 * 60 * 1000, // 5 minutes (was 5s for testing - too expensive!)
      refetchIntervalInBackground: false, // Don't refetch if app is in background/hidden
      refetchOnWindowFocus: true, // Refetch when user returns to window
      refetchOnReconnect: true, // Refetch when internet reconnects
      staleTime: 3 * 60 * 1000, // 3 minutes: Data considered fresh for 3 min (then marked stale)
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
