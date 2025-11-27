/**
 * Data Prefetcher - Ensures all critical data is loaded on app startup
 * This populates React Query cache immediately, then listeners keep it fresh
 */

import { queryClient } from './queryClient';

const ENDPOINTS = [
  '/api/buildings',
  '/api/floors',
  '/api/rooms',
  '/api/staff',
  '/api/events',
  '/api/walkpaths',
  '/api/drivepaths',
  '/api/indoor-nodes',
  '/api/room-paths',
  '/api/settings',
];

export async function prefetchAllData() {
  console.log('[PREFETCH] Starting data prefetch for all collections...');
  
  const prefetchPromises = ENDPOINTS.map(endpoint =>
    queryClient.prefetchQuery({
      queryKey: [endpoint],
      staleTime: 60 * 1000, // 1 minute
    }).catch(err => {
      console.error(`[PREFETCH] Failed to prefetch ${endpoint}:`, err);
    })
  );
  
  await Promise.all(prefetchPromises);
  console.log('[PREFETCH] All data prefetched successfully');
}
