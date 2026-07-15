import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Station, NearbyStationResponse } from '../types/station';
import { calculateDistance } from '../utils/distance';

dotenv.config();

const DATA_FILE_PATH = path.resolve(
  process.cwd(),
  process.env.DATA_FILE_PATH || 'data/xp100_stations.json',
);

/**
 * Service to manage access to the saved XP100 stations data.
 */
export class StationService {
  /**
   * Reads all stations directly from the JSON file.
   * Returns an empty array if the file does not exist.
   */
  public static getAllRawStations(): Station[] {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      console.warn(
        `[StationService] Data file not found at ${DATA_FILE_PATH}. Returning empty list.`,
      );
      return [];
    }
    try {
      const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(rawData) as Station[];
    } catch (error) {
      throw new Error(`JSON parsing failure: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves, filters, and paginates stations.
   */
  public static getStations(params: {
    page?: number;
    limit?: number;
    city?: string;
    search?: string;
  }):
    | {
        stations: Station[];
        pagination?: { total: number; page: number; limit: number; totalPages: number };
      }
    | Station[] {
    let stations = this.getAllRawStations();

    // 1. Filter by city (case-insensitive exact match)
    if (params.city) {
      const cityLower = params.city.trim().toLowerCase();
      stations = stations.filter((s) => s.city.toLowerCase() === cityLower);
    }

    // 2. Filter by search query (case-insensitive substring across multiple fields)
    if (params.search) {
      const searchLower = params.search.trim().toLowerCase();
      stations = stations.filter(
        (s) =>
          (s.stationName || '').toLowerCase().includes(searchLower) ||
          (s.city || '').toLowerCase().includes(searchLower) ||
          (s.address || '').toLowerCase().includes(searchLower) ||
          (s.state || '').toLowerCase().includes(searchLower) ||
          (s.salesArea || '').toLowerCase().includes(searchLower) ||
          (s.divisionalOffice || '').toLowerCase().includes(searchLower) ||
          (s.stateOffice || '').toLowerCase().includes(searchLower) ||
          (s.roCode || '').toLowerCase().includes(searchLower),
      );
    }

    // 3. Paginate if parameters are provided
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

    // Return the full array directly if no pagination was requested
    return stations;
  }

  /**
   * Finds stations within a given radius from a starting coordinate,
   * sorted by distance ascending.
   */
  public static getNearbyStations(
    lat: number,
    lng: number,
    radius = 100,
    limit = 10,
  ): NearbyStationResponse[] {
    const stations = this.getAllRawStations();

    const results: NearbyStationResponse[] = [];

    for (const station of stations) {
      const distance = calculateDistance(lat, lng, station.latitude, station.longitude);

      if (distance <= radius) {
        results.push({
          roCode: station.roCode,
          stationName: station.stationName,
          city: station.city,
          stateOffice: station.stateOffice,
          divisionalOffice: station.divisionalOffice,
          salesArea: station.salesArea,
          latitude: station.latitude,
          longitude: station.longitude,
          distance,
          googleMapsUrl: station.googleMapsUrl,
        });
      }
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distance - b.distance);

    // Slice to the requested limit
    return results.slice(0, limit);
  }

  /**
   * Finds a single station by its unique RO Code.
   */
  public static getStationByRoCode(roCode: string): Station | undefined {
    const stations = this.getAllRawStations();
    return stations.find((s) => s.roCode === roCode);
  }
}
