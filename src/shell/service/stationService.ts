import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { ShellStation, NearbyStationResponse } from '../types/station';
import { fetchShellApi } from '../scraper/scraperService';

dotenv.config();

const DATA_FILE_PATH = path.resolve(process.cwd(), 'data/shellPremiumPetrol.json');

/**
 * Service to manage queries and operations on Shell Premium Petrol station data.
 */
export class ShellStationService {
  /**
   * Reads all cached Shell stations from the JSON database file.
   * Throws an error on JSON parsing failure.
   */
  public static getAllRawStations(): ShellStation[] {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      console.warn(
        `[ShellStationService] Cached data file not found at ${DATA_FILE_PATH}. Returning empty list.`,
      );
      return [];
    }
    try {
      const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(rawData) as ShellStation[];
    } catch (error) {
      throw new Error(`JSON parsing failure: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves, filters, and paginates Shell stations.
   */
  public static getStations(params: {
    page?: number;
    limit?: number;
    city?: string;
    state?: string;
    search?: string;
    sortBy?: string;
    order?: string;
  }):
    | {
        stations: ShellStation[];
        pagination?: { total: number; page: number; limit: number; totalPages: number };
      }
    | ShellStation[] {
    let stations = this.getAllRawStations();

    // 1. Filter by city (case-insensitive exact match)
    if (params.city) {
      const cityLower = params.city.trim().toLowerCase();
      stations = stations.filter((s) => s.city.toLowerCase() === cityLower);
    }

    // 2. Filter by state (case-insensitive exact match)
    if (params.state) {
      const stateLower = params.state.trim().toLowerCase();
      stations = stations.filter((s) => s.state && s.state.toLowerCase() === stateLower);
    }

    // 3. Filter by search query (case-insensitive substring across multiple fields)
    if (params.search) {
      const searchLower = params.search.trim().toLowerCase();
      stations = stations.filter(
        (s) =>
          (s.stationName || '').toLowerCase().includes(searchLower) ||
          (s.city || '').toLowerCase().includes(searchLower) ||
          (s.address || '').toLowerCase().includes(searchLower) ||
          (s.state || '').toLowerCase().includes(searchLower) ||
          (s.postcode || '').toLowerCase().includes(searchLower) ||
          (s.stationId || '').toLowerCase().includes(searchLower),
      );
    }

    // 4. Sort stations
    if (params.sortBy) {
      const field = params.sortBy;
      const orderSign = params.order?.toLowerCase() === 'desc' ? -1 : 1;

      if (field === 'distance') {
        stations.sort((a, b) => (a.distance - b.distance) * orderSign);
      } else if (['stationName', 'city', 'state', 'stationId'].includes(field)) {
        stations.sort((a, b) => {
          const valA = (a[field as keyof ShellStation] || '') as string;
          const valB = (b[field as keyof ShellStation] || '') as string;
          return valA.localeCompare(valB) * orderSign;
        });
      }
    }

    // 5. Paginate if parameters are provided
    if (params.page !== undefined || params.limit !== undefined) {
      const total = stations.length;
      const page = params.page && params.page > 0 ? params.page : 1;
      const limit = params.limit && params.limit > 0 ? params.limit : 10;
      const totalPages = Math.ceil(total / limit);

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedStations = stations.slice(startIndex, endIndex);

      return {
        stations: paginatedStations,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    }

    return stations;
  }

  /**
   * Finds Shell stations nearby by querying the Shell live locator API,
   * filtering for premium petrol support, and enforcing the radius boundary.
   */
  public static async getNearbyStations(params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
    order?: string;
  }): Promise<NearbyStationResponse[]> {
    const radius = params.radius || 100;
    const limit = params.limit || 10;
    const orderSign = params.order?.toLowerCase() === 'desc' ? -1 : 1;

    // Fetch locations dynamically from the Shell API
    const locations = await fetchShellApi(params.lat, params.lng, 50);
    const results: NearbyStationResponse[] = [];

    for (const loc of locations) {
      if (loc.lat === undefined || loc.lng === undefined || loc.lat === null || loc.lng === null) {
        continue;
      }

      const stationLat = parseFloat(loc.lat);
      const stationLng = parseFloat(loc.lng);
      if (isNaN(stationLat) || isNaN(stationLng)) {
        continue;
      }

      // Filter for premium gasoline
      const fuelsList = loc.fuels || [];
      const hasPremiumPetrol = fuelsList.some((f: string) => {
        const fuelLower = f.toLowerCase();
        return (
          fuelLower === 'premium_gasoline' ||
          fuelLower === 'premium_petrol' ||
          fuelLower === 'premium gasoline' ||
          fuelLower.includes('v-power') ||
          fuelLower.includes('vpower')
        );
      });

      if (!hasPremiumPetrol) {
        continue;
      }

      const distance = loc.distance !== undefined ? parseFloat(loc.distance) : 9999;
      if (distance <= radius) {
        const stationId = String(loc.id);
        const state = loc.state || 'Unknown';

        results.push({
          stationName: loc.name,
          city: loc.city,
          state,
          latitude: stationLat,
          longitude: stationLng,
          distance,
          power95Price: null,
          petrolPrice: null,
          dieselPrice: null,
          turboJetPrice: null,
          stationUrl: loc.website_url || '',
          googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${stationLat},${stationLng}`,
          roCode: stationId,
          stateOffice: state || null,
          divisionalOffice: null,
          salesArea: null,
        });
      }
    }

    // Sort by API returned distance
    results.sort((a, b) => (a.distance - b.distance) * orderSign);

    return results.slice(0, limit);
  }

  /**
   * Finds a single Shell station by its unique Station ID.
   */
  public static getStationById(stationId: string): ShellStation | undefined {
    const stations = this.getAllRawStations();
    return stations.find((s) => s.stationId === stationId);
  }
}
