import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { FilterBar } from './components/FilterBar';
import { PriceSummary } from './components/PriceSummary';
import { LocationCard } from './components/LocationCard';
import { StationCard } from './components/StationCard';
import { ComparisonTable } from './components/ComparisonTable';
import { ErrorCard } from './components/ErrorCard';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { Footer } from './components/Footer';
import { PermissionInstructionsModal } from './components/PermissionInstructionsModal';
import { useGeolocation } from './hooks/useGeolocation';
import { useTheme } from './hooks/useTheme';
import { PetrolFinderAPI } from './services/api';
import type { UnifiedStation } from './types';
import { ALL_INDIAN_CITIES } from './utils/cities';
import type { CityCoords } from './utils/cities';
import { Heart, Table } from 'lucide-react';


export default function App() {
  const { toggleTheme, isDark } = useTheme();
  const { latitude, longitude, city, permissionStatus, retry, setCustomLocation } = useGeolocation();

  const handleRetryLocation = useCallback(() => {
    if (permissionStatus === 'denied') {
      setShowPermissionModal(true);
    } else {
      retry();
    }
  }, [permissionStatus, retry]);

  // Search, filter, sorting, compare state
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState(10);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'name'>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showComparison, setShowComparison] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [limitTo10, setLimitTo10] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Data fetching and UI status state
  const [stations, setStations] = useState<UnifiedStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  // Favorites state (stored in localStorage)
  const [favorites, setFavorites] = useState<{ id: string; brand: string }[]>(() => {
    try {
      const saved = localStorage.getItem('premium_petrol_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save favorites when state changes
  useEffect(() => {
    localStorage.setItem('premium_petrol_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const handleToggleFavorite = (id: string, brand: string) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === id && f.brand === brand);
      if (exists) {
        return prev.filter((f) => !(f.id === id && f.brand === brand));
      } else {
        return [...prev, { id, brand }];
      }
    });
  };

  // Dynamic rendering limits to prevent DOM lag on mobile/desktop (Instant UX)
  const [ioclLimit, setIoclLimit] = useState(20);
  const [hpclLimit, setHpclLimit] = useState(20);
  const [bpclLimit, setBpclLimit] = useState(20);
  const [shellLimit, setShellLimit] = useState(20);

  // Reset rendering chunk sizes when filters or query parameters change
  useEffect(() => {
    setIoclLimit(20);
    setHpclLimit(20);
    setBpclLimit(20);
    setShellLimit(20);
  }, [search, radius, selectedBrand]);

  // Main data fetcher (downloads entire database once, all filtering and searching happens client-side)
  const loadData = useCallback(async () => {
    const targetLat = latitude;
    const targetLng = longitude;

    setIsLoading(true);
    setIsError(false);

    try {
      // 1. Run health check first
      await PetrolFinderAPI.checkHealth();

      // 2. Fetch full lists from endpoints in parallel (zero parameters to pull complete lists)
      const [allIocl, allHpcl, allBpcl, allShell] = await Promise.all([
        PetrolFinderAPI.getIOCLStations({}),
        PetrolFinderAPI.getHPCLStations({}),
        PetrolFinderAPI.getBPCLStations({}),
        PetrolFinderAPI.getShellStations({}),
      ]);

      // 3. Consolidate, merge datasets, and calculate distance client-side
      const consolidated: UnifiedStation[] = [];

      // Helper to calculate Haversine distance client-side
      const getDistance = (lat: number, lng: number) => {
        if (targetLat === null || targetLng === null) return undefined;
        const R = 6371; // Radius of the earth in km
        const dLat = ((lat - targetLat) * Math.PI) / 180;
        const dLon = ((lng - targetLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((targetLat * Math.PI) / 180) *
            Math.cos((lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // A. IOCL Merge
      for (const item of allIocl) {
        const dist = getDistance(item.latitude, item.longitude);
        consolidated.push({
          brand: 'IOCL',
          fuelType: item.fuelType || 'XP95/XP100',
          stationId: item.roCode,
          stationName: item.stationName,
          address: item.address || 'Address Not Available',
          city: item.city,
          state: item.state || 'Unknown',
          phone: item.phone,
          latitude: item.latitude,
          longitude: item.longitude,
          distance: dist,
          googleMapsUrl: item.googleMapsUrl,
          openingHours: item.openingHours,
          petrolPrice: item.petrolPrice,
          dieselPrice: item.dieselPrice,
          xp95Price: item.xp95Price,
          xp100Price: item.xp100Price,
          premiumFuelPrice: item.xp100Price && item.xp100Price > 0 ? item.xp100Price : item.xp95Price,
          stateOffice: item.stateOffice,
          divisionalOffice: item.divisionalOffice,
          salesArea: item.salesArea,
          stationUrl: item.stationUrl,
        });
      }

      // B. HPCL Merge
      for (const item of allHpcl) {
        const dist = getDistance(item.latitude, item.longitude);
        consolidated.push({
          brand: 'HPCL',
          fuelType: 'Power95',
          stationId: item.roCode || 'HPCL-' + item.stationName,
          stationName: item.stationName,
          address: item.address || 'Address Not Available',
          city: item.city,
          state: item.state || 'Unknown',
          phone: item.phone || null,
          latitude: item.latitude,
          longitude: item.longitude,
          distance: dist,
          googleMapsUrl: item.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`,
          openingHours: item.openingHours || 'Open 06:00 AM - 11:00 PM',
          petrolPrice: item.petrolPrice,
          dieselPrice: item.dieselPrice,
          power95Price: item.power95Price,
          turboJetPrice: item.turboJetPrice,
          premiumFuelPrice: item.power95Price,
          stateOffice: item.stateOffice,
          divisionalOffice: item.divisionalOffice,
          salesArea: item.salesArea,
          stationUrl: item.stationUrl,
        });
      }

      // C. BPCL Merge
      for (const item of allBpcl) {
        const dist = getDistance(item.latitude, item.longitude);
        consolidated.push({
          brand: 'BPCL',
          fuelType: 'Speed97',
          stationId: item.roId,
          stationName: item.stationName,
          address: item.address || 'Address Not Available',
          city: item.city,
          state: item.state || 'Unknown',
          phone: item.phone || null,
          latitude: item.latitude,
          longitude: item.longitude,
          distance: dist,
          googleMapsUrl: item.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`,
          openingHours: item.openingHours || null,
          petrolPrice: item.petrolPrice,
          dieselPrice: item.dieselPrice,
          speedPrice: item.speedPrice,
          premiumFuelPrice: item.speedPrice,
        });
      }

      // D. Shell Merge
      for (const item of allShell) {
        const dist = getDistance(item.latitude, item.longitude);
        consolidated.push({
          brand: 'Shell',
          fuelType: 'V-Power',
          stationId: item.stationId || 'Shell-' + item.stationName,
          stationName: item.stationName,
          address: item.address || 'Address Not Available',
          city: item.city,
          state: item.state || 'Unknown',
          phone: item.phone || null,
          latitude: item.latitude,
          longitude: item.longitude,
          distance: dist,
          googleMapsUrl: item.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`,
          openingHours: item.openingHours || 'Open 06:00 AM - 11:00 PM',
          petrolPrice: item.petrolPrice || null,
          dieselPrice: item.dieselPrice || null,
          premiumFuelPrice: item.xp95Price || null,
          fuels: item.fuels,
          amenities: item.amenities,
        });
      }

      setStations(consolidated);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error: any) {
      console.error('[App] Failed loading data:', error);
      setIsError(true);
      setErrorMessage(error.message || 'Server connectivity issues.');
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude]);

  // Create a map of unique cities in the database to their first station coordinates (for fallback dynamic geocoding)
  const uniqueCitiesInDb = useMemo(() => {
    const citiesMap = new Map<string, { lat: number; lng: number }>();
    stations.forEach((s) => {
      if (s.city && s.latitude && s.longitude) {
        const cityName = s.city.trim().toUpperCase();
        if (!citiesMap.has(cityName)) {
          citiesMap.set(cityName, { lat: s.latitude, lng: s.longitude });
        }
      }
    });
    return citiesMap;
  }, [stations]);

  // Automatically update location coordinates when the user inputs a city name in search (Instant & 100% Offline)
  useEffect(() => {
    if (!search.trim()) return;
    const query = search.trim().toUpperCase();

    // 1. Check static comprehensive geocoding database first (covering major cities like Jabalpur, Indore, Noida, etc.)
    const staticMatch = ALL_INDIAN_CITIES.find(
      (c) => c.name.toUpperCase() === query || c.name.toUpperCase().split(' ').includes(query)
    );

    if (staticMatch) {
      if (latitude !== staticMatch.lat || longitude !== staticMatch.lng) {
        setCustomLocation(staticMatch.lat, staticMatch.lng, staticMatch.name);
      }
      return;
    }

    // 2. Fallback to dynamic database match (scanning current station listings city names)
    const matchedCityKey = Array.from(uniqueCitiesInDb.keys()).find(
      (c) => c === query || c.split(' ').includes(query)
    );

    if (matchedCityKey) {
      const coords = uniqueCitiesInDb.get(matchedCityKey);
      if (coords && (latitude !== coords.lat || longitude !== coords.lng)) {
        const formattedCityName = matchedCityKey
          .toLowerCase()
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        setCustomLocation(coords.lat, coords.lng, formattedCityName);
      }
    }
  }, [search, uniqueCitiesInDb, latitude, longitude, setCustomLocation]);

  // Load data immediately on coordinates update
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter & Sort station results (fully client-side & instantaneous!)
  const filteredAndSortedStations = useMemo(() => {
    let results = stations;

    // 1. Search term filter (in-memory)
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (s) =>
          (s.stationName?.toLowerCase() || '').includes(q) ||
          (s.city?.toLowerCase() || '').includes(q) ||
          (s.state?.toLowerCase() || '').includes(q) ||
          (s.address?.toLowerCase() || '').includes(q) ||
          (s.stationId?.toLowerCase() || '').includes(q)
      );
    }

    // 2. Radius filter (in-memory) - Only apply if there is no active search query
    if (!search.trim() && latitude !== null && longitude !== null && radius !== undefined) {
      results = results.filter((s) => s.distance === undefined || s.distance <= radius);
    }

    // 3. Filter by brand
    if (selectedBrand !== 'All') {
      results = results.filter((s) => s.brand === selectedBrand);
    }

    // 4. Filter by favorites
    if (showFavoritesOnly) {
      results = results.filter((s) =>
        favorites.some((f) => f.id === s.stationId && f.brand === s.brand)
      );
    }

    // 5. Sort
    return [...results].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortBy === 'distance') {
        valA = a.distance ?? 9999;
        valB = b.distance ?? 9999;
      } else if (sortBy === 'price') {
        valA = a.premiumFuelPrice ?? 9999;
        valB = b.premiumFuelPrice ?? 9999;
      } else if (sortBy === 'name') {
        valA = a.stationName;
        valB = b.stationName;
      }

      if (valA === valB) return 0;
      const orderSign = sortOrder === 'desc' ? -1 : 1;
      return valA > valB ? orderSign : -orderSign;
    });
  }, [stations, search, radius, latitude, longitude, selectedBrand, sortBy, sortOrder, showFavoritesOnly, favorites]);

  // Sliced lists for rendering (optimizing DOM performance)
  const ioclRawStations = useMemo(
    () => filteredAndSortedStations.filter((s) => s.brand === 'IOCL'),
    [filteredAndSortedStations]
  );
  const ioclStations = useMemo(
    () => ioclRawStations.slice(0, limitTo10 ? 10 : ioclLimit),
    [ioclRawStations, limitTo10, ioclLimit]
  );

  const hpclRawStations = useMemo(
    () => filteredAndSortedStations.filter((s) => s.brand === 'HPCL'),
    [filteredAndSortedStations]
  );
  const hpclStations = useMemo(
    () => hpclRawStations.slice(0, limitTo10 ? 10 : hpclLimit),
    [hpclRawStations, limitTo10, hpclLimit]
  );

  const bpclRawStations = useMemo(
    () => filteredAndSortedStations.filter((s) => s.brand === 'BPCL'),
    [filteredAndSortedStations]
  );
  const bpclStations = useMemo(
    () => bpclRawStations.slice(0, limitTo10 ? 10 : bpclLimit),
    [bpclRawStations, limitTo10, bpclLimit]
  );

  const shellRawStations = useMemo(
    () => filteredAndSortedStations.filter((s) => s.brand === 'Shell'),
    [filteredAndSortedStations]
  );
  const shellStations = useMemo(
    () => shellRawStations.slice(0, limitTo10 ? 10 : shellLimit),
    [shellRawStations, limitTo10, shellLimit]
  );

  const handleSelectCity = (c: CityCoords) => {
    setCustomLocation(c.lat, c.lng, c.name);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navbar */}
      <Navbar
        isDark={isDark}
        toggleTheme={toggleTheme}
        latitude={latitude}
        longitude={longitude}
        city={city}
        permissionStatus={permissionStatus}
        onRefreshLocation={handleRetryLocation}
        isLoading={isLoading}
      />

      {/* Main Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Connection Offline view */}
        {isError ? (
          <div className="my-12">
            <ErrorCard message={errorMessage} onRetry={loadData} />
          </div>
        ) : (
          <>
            {/* Intro Hero Section */}
            <Hero
              latitude={latitude}
              longitude={longitude}
              city={city}
              totalStations={filteredAndSortedStations.length}
              lastUpdated={lastUpdated || 'Never'}
            />

            {/* Geolocation Card (Explains block fallback state) */}
            <LocationCard
              hasCoords={latitude !== null && longitude !== null}
              city={city}
              permissionStatus={permissionStatus}
              onSelectCity={handleSelectCity}
              onRetry={handleRetryLocation}
              isLoading={isLoading}
            />

            {/* Analytics summary rows */}
            <PriceSummary stations={filteredAndSortedStations} />

            {/* Sticky Filtering controls */}
            <FilterBar
              search={search}
              setSearch={setSearch}
              radius={radius}
              setRadius={setRadius}
              selectedBrand={selectedBrand}
              setSelectedBrand={setSelectedBrand}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              limitTo10={limitTo10}
              setLimitTo10={setLimitTo10}
            />

            {/* Matrix comparison button */}
            <div className="flex gap-3 justify-end items-center flex-wrap">
              {/* Toggle Favorites list */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border active:scale-95 cursor-pointer ${
                  showFavoritesOnly
                    ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Heart size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                {showFavoritesOnly ? 'Showing Favorites' : 'Favorites Only'}
              </button>

              {/* Toggle Comparison matrix */}
              <button
                onClick={() => setShowComparison(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-slate-900/10 dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-50 hover:shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <Table size={14} />
                Compare Prices
              </button>
            </div>

            {/* Compare Prices Modal */}
            {showComparison && (
              <ComparisonTable
                stations={filteredAndSortedStations}
                onClose={() => setShowComparison(false)}
              />
            )}

            {/* Main Outlet sections loading */}
            {isLoading ? (
              <div className="space-y-12 my-6">
                <div>
                  <div className="h-6 w-48 bg-slate-200 dark:bg-slate-850 rounded mb-4" />
                  <LoadingSkeleton />
                </div>
                <div>
                  <div className="h-6 w-48 bg-slate-200 dark:bg-slate-850 rounded mb-4" />
                  <LoadingSkeleton />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-12">
                {/* 1. INDIANOIL XP PREMIUM */}
                {(selectedBrand === 'All' || selectedBrand === 'IOCL') && (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                      <div className="bg-orange-500 text-white p-1.5 rounded-lg text-xs font-black">IOC</div>
                      <h2 className="text-xl font-extrabold font-display text-slate-900 dark:text-slate-100">
                        IndianOil XP Premium Outlets
                      </h2>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-1">
                        {ioclRawStations.length}
                      </span>
                    </div>

                    {ioclStations.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-900/30 p-8 rounded-3xl text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 dark:border-slate-800">
                        No premium petrol stations found nearby.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {ioclStations.map((st) => (
                            <StationCard
                              key={'IOCL-' + st.stationId}
                              station={st}
                              isFavorite={favorites.some((f) => f.id === st.stationId && f.brand === 'IOCL')}
                              onToggleFavorite={handleToggleFavorite}
                              userLatitude={latitude}
                              userLongitude={longitude}
                            />
                          ))}
                        </div>
                        
                        {!limitTo10 && ioclRawStations.length > ioclLimit && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={() => setIoclLimit((prev) => prev + 20)}
                              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/85 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                            >
                              Load More (+{ioclRawStations.length - ioclLimit} stations)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* 2. HPCL POWER95 */}
                {(selectedBrand === 'All' || selectedBrand === 'HPCL') && (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                      <div className="bg-blue-600 text-white p-1.5 rounded-lg text-xs font-black">HP</div>
                      <h2 className="text-xl font-extrabold font-display text-slate-900 dark:text-slate-100">
                        HPCL Power95 Outlets
                      </h2>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-1">
                        {hpclRawStations.length}
                      </span>
                    </div>

                    {hpclStations.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-900/30 p-8 rounded-3xl text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 dark:border-slate-800">
                        No premium petrol stations found nearby.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {hpclStations.map((st) => (
                            <StationCard
                              key={'HPCL-' + st.stationId}
                              station={st}
                              isFavorite={favorites.some((f) => f.id === st.stationId && f.brand === 'HPCL')}
                              onToggleFavorite={handleToggleFavorite}
                              userLatitude={latitude}
                              userLongitude={longitude}
                            />
                          ))}
                        </div>

                        {!limitTo10 && hpclRawStations.length > hpclLimit && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={() => setHpclLimit((prev) => prev + 20)}
                              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/85 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                            >
                              Load More (+{hpclRawStations.length - hpclLimit} stations)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* 3. BPCL SPEED97 */}
                {(selectedBrand === 'All' || selectedBrand === 'BPCL') && (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                      <div className="bg-emerald-600 text-white p-1.5 rounded-lg text-xs font-black">BP</div>
                      <h2 className="text-xl font-extrabold font-display text-slate-900 dark:text-slate-100">
                        BPCL Speed97 Outlets
                      </h2>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-1">
                        {bpclRawStations.length}
                      </span>
                    </div>

                    {bpclStations.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-900/30 p-8 rounded-3xl text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 dark:border-slate-800">
                        No premium petrol stations found nearby.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {bpclStations.map((st) => (
                            <StationCard
                              key={'BPCL-' + st.stationId}
                              station={st}
                              isFavorite={favorites.some((f) => f.id === st.stationId && f.brand === 'BPCL')}
                              onToggleFavorite={handleToggleFavorite}
                              userLatitude={latitude}
                              userLongitude={longitude}
                            />
                          ))}
                        </div>

                        {!limitTo10 && bpclRawStations.length > bpclLimit && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={() => setBpclLimit((prev) => prev + 20)}
                              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/85 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                            >
                              Load More (+{bpclRawStations.length - bpclLimit} stations)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* 4. SHELL V-POWER */}
                {(selectedBrand === 'All' || selectedBrand === 'Shell') && (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                      <div className="bg-yellow-500 text-slate-900 p-1.5 rounded-lg text-xs font-black">SH</div>
                      <h2 className="text-xl font-extrabold font-display text-slate-900 dark:text-slate-100">
                        Shell V-Power Outlets
                      </h2>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-1">
                        {shellRawStations.length}
                      </span>
                    </div>

                    {shellStations.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-900/30 p-8 rounded-3xl text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 dark:border-slate-800">
                        No premium petrol stations found nearby.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {shellStations.map((st) => (
                            <StationCard
                              key={'Shell-' + st.stationId}
                              station={st}
                              isFavorite={favorites.some((f) => f.id === st.stationId && f.brand === 'Shell')}
                              onToggleFavorite={handleToggleFavorite}
                              userLatitude={latitude}
                              userLongitude={longitude}
                            />
                          ))}
                        </div>

                        {!limitTo10 && shellRawStations.length > shellLimit && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={() => setShellLimit((prev) => prev + 20)}
                              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/85 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                            >
                              Load More (+{shellRawStations.length - shellLimit} stations)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Browser Permission Reset Guide Modal */}
      <PermissionInstructionsModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
      />
    </div>
  );
}
