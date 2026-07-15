import React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface FilterBarProps {
  search: string;
  setSearch: (s: string) => void;
  radius: number;
  setRadius: (r: number) => void;
  selectedBrand: string;
  setSelectedBrand: (b: string) => void;
  sortBy: 'distance' | 'price' | 'name';
  setSortBy: (s: 'distance' | 'price' | 'name') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (o: 'asc' | 'desc') => void;
  limitTo10: boolean;
  setLimitTo10: (l: boolean) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  setSearch,
  radius,
  setRadius,
  selectedBrand,
  setSelectedBrand,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  limitTo10,
  setLimitTo10,
}) => {
  return (
    <div className="sticky top-20 z-40 w-full glassmorphism p-5 rounded-3xl shadow-xl shadow-slate-100 dark:shadow-none border border-slate-200/60 dark:border-slate-800/80 flex flex-col gap-4">
      {/* Search and Top Controls Row */}
      <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full">
        {/* Search Input */}
        <div className="relative flex-grow">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by station name, city, state, or RO code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 dark:focus:ring-rose-400/30 transition-all placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>

        {/* Sorting Fields */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <SlidersHorizontal size={14} />
            <span>Sort By</span>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="distance">Distance</option>
            <option value="price">Premium Price</option>
            <option value="name">Station Name</option>
          </select>

          {/* Toggle Sort Order button */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer"
            title={`Sort Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
          >
            <ArrowUpDown size={16} />
          </button>
        </div>
      </div>

      {/* Brand & Radius row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Brand selection pills */}
        <div className="flex flex-wrap gap-2">
          {['All', 'IOCL', 'HPCL', 'BPCL', 'Shell'].map((brand) => (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedBrand === brand
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md shadow-slate-950/15 dark:shadow-none'
                  : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {brand === 'All' ? 'All Brands' : brand === 'IOCL' ? 'IndianOil' : brand === 'HPCL' ? 'HPCL' : brand === 'BPCL' ? 'BPCL' : 'Shell'}
            </button>
          ))}
        </div>

        {/* Radius & Limit toggle group */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Limit Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Max Results</span>
            <button
              onClick={() => setLimitTo10(!limitTo10)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 ${
                limitTo10
                  ? 'bg-rose-500 text-white border-transparent shadow-md shadow-rose-500/20'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {limitTo10 ? 'Top 10' : 'Show All'}
            </button>
          </div>

          {/* Radius selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Search Radius</span>
            <div className="flex bg-slate-100/80 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
              {[5, 10, 20, 50, 100].map((r) => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    radius === r
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
