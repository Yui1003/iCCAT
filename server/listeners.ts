/**
 * Real-Time Listener Manager
 * Pub/Sub system for broadcasting data changes to all connected clients
 * When admin makes changes, all connected listeners get notified instantly
 */

import { EventEmitter } from 'events';

type ListenerType = 'buildings' | 'events' | 'staff' | 'floors' | 'rooms' | 'walkpaths' | 'drivepaths' | 'pwd-paths' | 'indoor-nodes' | 'room-paths' | 'settings' | 'kiosk-uptime';

interface ClientConnection {
  res: any;
  type: ListenerType;
  connected: boolean;
}

class ListenerManager extends EventEmitter {
  private clients: Map<string, ClientConnection[]> = new Map();
  
  constructor() {
    super();
    // Initialize maps for each collection type
    const types: ListenerType[] = ['buildings', 'events', 'staff', 'floors', 'rooms', 'walkpaths', 'drivepaths', 'indoor-nodes', 'room-paths', 'settings', 'kiosk-uptime'];
    types.forEach(type => {
      this.clients.set(type, []);
    });
  }

  /**
   * Register a connected client for a specific collection
   */
  registerClient(type: ListenerType, res: any, clientId: string) {
    if (!this.clients.has(type)) {
      this.clients.set(type, []);
    }
    
    const client: ClientConnection = {
      res,
      type,
      connected: true
    };
    
    const list = this.clients.get(type)!;
    list.push(client);
    
    console.log(`[LISTENER] Client ${clientId} registered for ${type} (${list.length} total)`);
    
    // Handle client disconnect
    res.on('close', () => {
      client.connected = false;
      const idx = list.indexOf(client);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      console.log(`[LISTENER] Client ${clientId} disconnected from ${type} (${list.length} remaining)`);
    });

    res.on('error', () => {
      client.connected = false;
      const idx = list.indexOf(client);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    });
  }

  /**
   * Broadcast updated data to all connected clients for a specific collection
   */
  broadcastUpdate(type: ListenerType, data: any) {
    const clients = this.clients.get(type) || [];
    console.log(`[LISTENER] Broadcasting update to ${clients.length} clients for ${type}`);
    
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    clients.forEach(client => {
      if (client.connected && !client.res.destroyed) {
        try {
          client.res.write(message);
        } catch (err) {
          console.error(`[LISTENER] Failed to send update to client:`, err);
          client.connected = false;
        }
      }
    });
  }

  /**
   * Broadcast to multiple related collections (e.g., when building changes, notify related data)
   */
  broadcastMultiple(types: ListenerType[], data: Record<ListenerType, any>) {
    types.forEach(type => {
      if (data[type]) {
        this.broadcastUpdate(type, data[type]);
      }
    });
  }

  /**
   * Get connected client count for a collection
   */
  getConnectedCount(type: ListenerType): number {
    const clients = this.clients.get(type) || [];
    return clients.filter(c => c.connected).length;
  }
}

// Global listener manager instance
export const listenerManager = new ListenerManager();

/**
 * Helper: Notify all listeners when buildings change
 */
export function notifyBuildingsChange(buildings: any[]) {
  listenerManager.broadcastUpdate('buildings', buildings);
}

/**
 * Helper: Notify all listeners when events change
 */
export function notifyEventsChange(events: any[]) {
  listenerManager.broadcastUpdate('events', events);
}

/**
 * Helper: Notify all listeners when staff change
 */
export function notifyStaffChange(staff: any[]) {
  listenerManager.broadcastUpdate('staff', staff);
}

/**
 * Helper: Notify all listeners when floors change
 */
export function notifyFloorsChange(floors: any[]) {
  listenerManager.broadcastUpdate('floors', floors);
}

/**
 * Helper: Notify all listeners when rooms change
 */
export function notifyRoomsChange(rooms: any[]) {
  listenerManager.broadcastUpdate('rooms', rooms);
}

/**
 * Helper: Notify all listeners when walkpaths change
 */
export function notifyWalkpathsChange(walkpaths: any[]) {
  listenerManager.broadcastUpdate('walkpaths', walkpaths);
}

/**
 * Helper: Notify all listeners when drivepaths change
 */
export function notifyDrivepathsChange(drivepaths: any[]) {
  listenerManager.broadcastUpdate('drivepaths', drivepaths);
}

/**
 * Helper: Notify all listeners when PWD paths change
 */
export function notifyPwdPathsChange(pwdPaths: any[]) {
  listenerManager.broadcastUpdate('pwd-paths', pwdPaths);
}

/**
 * Helper: Notify all listeners when indoor nodes change
 */
export function notifyIndoorNodesChange(indoorNodes: any[]) {
  listenerManager.broadcastUpdate('indoor-nodes', indoorNodes);
}

/**
 * Helper: Notify all listeners when room paths change
 */
export function notifyRoomPathsChange(roomPaths: any[]) {
  listenerManager.broadcastUpdate('room-paths', roomPaths);
}

/**
 * Helper: Notify all listeners when settings change
 */
export function notifySettingsChange(settings: any[]) {
  listenerManager.broadcastUpdate('settings', settings);
}

export function notifyAnalyticsReset() {
  // Broadcast reset event to all settings listeners (they will refetch)
  listenerManager.broadcastUpdate('settings', { _reset: true, timestamp: Date.now() });
}

export function notifyKioskUptimeChange(uptimes: any[]) {
  listenerManager.broadcastUpdate('kiosk-uptime', uptimes);
}
