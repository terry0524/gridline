import { offline } from './config.js';

const cache = new Map();
export async function raceCloud(location, start) {
 if (offline || !location || !Number.isFinite(start) || start >= Date.now()) return null;
 if (location.lat == null || location.long == null) return null;
 const latitude = Number(location.lat), longitude = Number(location.long);
 if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
     Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
 const hour = Math.round(start / 3600000) * 3600000;
 const date = new Date(hour).toISOString();
 const day = date.slice(0, 10);
 const query = new URLSearchParams({
  latitude, longitude, start_date: day, end_date: day, hourly: 'cloud_cover', timezone: 'GMT',
 });
 const id = `${latitude}/${longitude}/${hour}`;
 if (cache.has(id)) return cache.get(id);
 try {
  const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${query}`, {signal: AbortSignal.timeout(4500)});
  if (!response.ok) return null;
  const { hourly } = await response.json();
  const index = hourly?.time?.indexOf(date.slice(0, 16)) ?? -1;
  const cover = hourly?.cloud_cover?.[index];
  if (!Number.isFinite(cover) || cover < 0 || cover > 100) return null;
  const result = {cover, source: 'Open-Meteo'};
  if (cache.size >= 128) cache.delete(cache.keys().next().value);
  cache.set(id, result);
  return result;
 } catch { return null; }
}
