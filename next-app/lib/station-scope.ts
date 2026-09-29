// Which production station's work a stage board is showing: everything,
// only in-house work, anything handed to an external station, or one
// named station. A single value — so the board can never show one
// station while another control still claims "todos".
export type StationScope = 'all' | 'internal' | 'external' | `station:${string}`;

const STATION_PREFIX = 'station:';

export const stationScope = (name: string): StationScope => `${STATION_PREFIX}${name}`;

/** The station a scope names, or null for all / internal / external. */
export const scopeStationName = (scope: StationScope): string | null =>
    scope.startsWith(STATION_PREFIX) ? scope.slice(STATION_PREFIX.length) : null;

/** Whether an order handed to `stations` belongs in `scope`. */
export const inStationScope = (stations: string[], scope: StationScope): boolean => {
    if (scope === 'all') return true;
    if (scope === 'internal') return stations.length === 0;
    if (scope === 'external') return stations.length > 0;
    return stations.includes(scope.slice(STATION_PREFIX.length));
};
