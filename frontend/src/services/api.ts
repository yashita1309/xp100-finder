import axios from 'axios';
import type { IOCLStation, HPCLStation, BPCLStation, ShellStation } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const client = axios.create({
  baseURL: BASE_URL,
});

// Helper to catch 404 (No results found) and convert to empty arrays
const safeRequest = async <T>(requestPromise: Promise<{ data: T }>): Promise<T> => {
  try {
    const response = await requestPromise;
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return [] as unknown as T;
    }
    throw error;
  }
};

export const PetrolFinderAPI = {
  // Test health check
  checkHealth: async (): Promise<{ status: string }> => {
    const res = await client.get('/health');
    return res.data;
  },

  // 1. IndianOil (XP95 & XP100 unified)
  getIOCLStations: async (params: {
    city?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<IOCLStation[]> => {
    // If pagination params are not passed, it returns array directly. 
    // If they are, it returns { stations: [], pagination: ... }. 
    // We force returning array directly by not passing pagination, or unpacking if returned.
    const data = await safeRequest<any>(client.get('/stations', { params }));
    if (data && typeof data === 'object' && Array.isArray(data.stations)) {
      return data.stations;
    }
    return Array.isArray(data) ? data : [];
  },

  getIOCLNearbyStations: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
  }): Promise<any[]> => {
    // Note: /stations/nearby does not return price fields.
    // We will merge it client-side with the full station data.
    return safeRequest<any[]>(client.get('/stations/nearby', { params }));
  },

  getIOCLStationByRoCode: async (roCode: string): Promise<IOCLStation> => {
    const res = await client.get(`/stations/${roCode}`);
    return res.data;
  },

  // 2. HPCL (Power95)
  getHPCLStations: async (params: {
    city?: string;
    state?: string;
    search?: string;
    fuelType?: string;
    priceMin?: number;
    priceMax?: number;
    sortBy?: string;
    order?: string;
    lat?: number;
    lng?: number;
  }): Promise<HPCLStation[]> => {
    const data = await safeRequest<any>(client.get('/hpcl/stations', { params }));
    if (data && typeof data === 'object' && Array.isArray(data.stations)) {
      return data.stations;
    }
    return Array.isArray(data) ? data : [];
  },

  getHPCLNearbyStations: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
    sortBy?: string;
    order?: string;
  }): Promise<any[]> => {
    return safeRequest<any[]>(client.get('/hpcl/stations/nearby', { params }));
  },

  // 3. BPCL (Speed97)
  getBPCLStations: async (params: {
    city?: string;
    search?: string;
    sortBy?: string;
    order?: string;
    lat?: number;
    lng?: number;
  }): Promise<BPCLStation[]> => {
    const data = await safeRequest<any>(client.get('/bpcl/stations', { params }));
    if (data && typeof data === 'object' && Array.isArray(data.stations)) {
      return data.stations;
    }
    return Array.isArray(data) ? data : [];
  },

  getBPCLNearbyStations: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
    sortBy?: string;
    order?: string;
  }): Promise<any[]> => {
    return safeRequest<any[]>(client.get('/bpcl/stations/nearby', { params }));
  },

  // 4. Shell (V-Power)
  getShellStations: async (params: {
    city?: string;
    state?: string;
    search?: string;
    sortBy?: string;
    order?: string;
  }): Promise<ShellStation[]> => {
    const data = await safeRequest<any>(client.get('/shell/stations', { params }));
    if (data && typeof data === 'object' && Array.isArray(data.stations)) {
      return data.stations;
    }
    return Array.isArray(data) ? data : [];
  },

  getShellNearbyStations: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
    order?: string;
  }): Promise<any[]> => {
    return safeRequest<any[]>(client.get('/shell/stations/nearby', { params }));
  },
};
