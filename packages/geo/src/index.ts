/**
 * @module @carpentry/geo
 * @description Geocoding, reverse geocoding, distance calculations, IP-to-location.
 *
 * Driver-based: swap between Google Maps, Mapbox, OpenStreetMap Nominatim,
 * and IP geolocation providers without changing application code.
 *
 * @patterns Strategy (geocoding drivers), Adapter (wraps vendor APIs)
 * @principles OCP — add providers without modifying core; DIP — depend on IGeocoder
 *
 * @example
 * ```ts
 * import { GeoManager, haversineDistance } from '@carpentry/geo';
 *
 * const geo = new GeoManager({ driver: 'nominatim' });
 * const coords = await geo.geocode('1600 Amphitheatre Parkway, Mountain View');
 * const address = await geo.reverse(37.4221, -122.0841);
 * const km = haversineDistance(
 *   { lat: 40.7128, lng: -74.0060 },
 *   { lat: 51.5074, lng:  -0.1278 },
 * );
 * ```
 */

// ── Types ─────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  coordinates: Coordinates;
  formattedAddress: string;
  components?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  };
  confidence?: number;
}

export interface IpLocationResult {
  coordinates: Coordinates;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  isp?: string;
}

// ── Contract ──────────────────────────────────────────────

export interface IGeocoder {
  /** Forward geocoding: address string → coordinates. */
  geocode(address: string): Promise<GeocodingResult[]>;
  /** Reverse geocoding: coordinates → address. */
  reverse(lat: number, lng: number): Promise<GeocodingResult[]>;
}

export interface IIpLocator {
  /** IP address → location data. */
  locate(ip: string): Promise<IpLocationResult>;
}

export interface GeoConfig {
  driver: string;
  apiKey?: string;
}

// ── Geo Manager ───────────────────────────────────────────

export class GeoManager implements IGeocoder {
  private drivers = new Map<string, IGeocoder>();
  private defaultDriver: string;

  constructor(config: GeoConfig) {
    this.defaultDriver = config.driver;
  }

  registerDriver(name: string, driver: IGeocoder): void {
    this.drivers.set(name, driver);
  }

  driver(name?: string): IGeocoder {
    const d = this.drivers.get(name ?? this.defaultDriver);
    if (!d) throw new Error(`Geo driver "${name ?? this.defaultDriver}" not registered.`);
    return d;
  }

  async geocode(address: string): Promise<GeocodingResult[]> {
    return this.driver().geocode(address);
  }

  async reverse(lat: number, lng: number): Promise<GeocodingResult[]> {
    return this.driver().reverse(lat, lng);
  }
}

// ── Distance Calculations ─────────────────────────────────

const EARTH_RADIUS_KM = 6371;

/** Haversine distance between two points in kilometres. */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Haversine distance in miles. */
export function haversineDistanceMiles(a: Coordinates, b: Coordinates): number {
  return haversineDistance(a, b) * 0.621371;
}

/** Check if a point is within a radius (km) of a center. */
export function isWithinRadius(
  point: Coordinates,
  center: Coordinates,
  radiusKm: number,
): boolean {
  return haversineDistance(point, center) <= radiusKm;
}

/**
 * Bounding box for a circle — useful for DB pre-filtering before
 * applying exact haversine post-filter.
 */
export function boundingBox(
  center: Coordinates,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}
