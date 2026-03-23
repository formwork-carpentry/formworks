/**
 * @module @carpentry/core/contracts/geo
 * @description Geocoding and geolocation contract.
 */

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

export interface IGeocoder {
  geocode(address: string): Promise<GeocodingResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodingResult[]>;
}

export interface IpLocationResult {
  coordinates: Coordinates;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
}

export interface IIpLocator {
  locate(ip: string): Promise<IpLocationResult>;
}
