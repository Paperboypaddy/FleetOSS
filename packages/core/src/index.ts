// ── Device ──
export interface Device {
  id: string;
  name: string;
  uniqueId: string;
  plate?: string;
  vin?: string;
  status: DeviceStatus;
  approved: boolean;
  position?: Position;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type DeviceStatus = 'online' | 'offline' | 'unknown';

// ── Position ──
export interface Position {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  accuracy?: number;
  course?: number;
  ignition?: boolean;
  engineHours?: number;
  odometer?: number;
  fuelLevel?: number;
  batteryLevel?: number;
  rpm?: number;
  fuelConsumption?: number;
  speedLimit?: number;
  valid: boolean;
  protocol: string;
  attributes: Record<string, unknown>;
  deviceTimestamp: string;
  serverTimestamp: string;
}

// ── Trip ──
export interface Trip {
  id: string;
  deviceId: string;
  startPositionId: string;
  endPositionId: string;
  startTime: string;
  endTime: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startAddress?: string;
  endAddress?: string;
  distance: number;
  duration: number;
  avgSpeed: number;
  maxSpeed: number;
  stopDuration?: number;
  attributes: Record<string, unknown>;
}

// ── Geofence ──
export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon' | 'polyline';
  latitude?: number;
  longitude?: number;
  radius?: number;
  polygon?: [number, number][];
  polyline?: [number, number][];
  attributes: Record<string, unknown>;
}

// ── Event ──
export interface Event {
  id: string;
  deviceId: string;
  type: EventType;
  positionId?: string;
  geofenceId?: string;
  geofenceName?: string;
  attributes: Record<string, unknown>;
  time: string;
}

export type EventType =
  | 'deviceOnline'
  | 'deviceOffline'
  | 'deviceMoving'
  | 'deviceStopped'
  | 'geofenceEnter'
  | 'geofenceExit'
  | 'alarm'
  | 'ignitionOn'
  | 'ignitionOff'
  | 'maintenance'
  | 'speeding'
  | 'report';

// ── Maintenance ──
export interface Maintenance {
  id: string;
  deviceId: string;
  name: string;
  type: MaintenanceType;
  intervalDays?: number;
  intervalMeters?: number;
  lastOdometer?: number;
  lastDate?: string;
  dueOdometer?: number;
  dueDate?: string;
  notes?: string;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type MaintenanceType = 'oil' | 'tires' | 'brakes' | 'service' | 'inspection' | 'other';

// ── Ingestion ──
export interface IngestedPosition {
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  accuracy?: number;
  ignition?: boolean;
  engineHours?: number;
  odometer?: number;
  fuelLevel?: number;
  batteryLevel?: number;
  rpm?: number;
  fuelConsumption?: number;
  speedLimit?: number;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

// ── API ──
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

// ── Auth ──
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authProvider: AuthProvider;
  authProviderId?: string;
  attributes: Record<string, unknown>;
  createdAt: string;
}

export type UserRole = 'admin' | 'manager' | 'viewer';

export type AuthProvider = 'local' | 'ldap' | 'oidc' | 'oauth2' | 'saml';

export interface AuthProviderInfo {
  id: AuthProvider;
  name: string;
  type: 'form' | 'redirect';
  loginUrl?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  sessionSecret: string;
  providers: Record<string, { enabled: boolean } & Record<string, unknown>>;
}

// ── WebSocket Events ──
export type WsEvent =
  | { type: 'position'; data: Position }
  | { type: 'deviceStatus'; data: { deviceId: string; status: DeviceStatus } }
  | { type: 'event'; data: Event }
  | { type: 'trip'; data: Trip };
