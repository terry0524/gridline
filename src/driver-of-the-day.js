// Verified against the season award tables at formula1.com.
// Use circuit IDs because round order and Grand Prix titles can differ between sources.
const winners = {
 2023: {
  bahrain: 'ALO', jeddah: 'VER', albert_park: 'PER', baku: 'PER', miami: 'VER',
  monaco: 'OCO', catalunya: 'HAM', villeneuve: 'ALB', red_bull_ring: 'NOR',
  silverstone: 'NOR', hungaroring: 'PER', spa: 'VER', zandvoort: 'ALO', monza: 'SAI',
  marina_bay: 'SAI', suzuka: 'PIA', losail: 'PIA', americas: 'NOR', rodriguez: 'NOR',
  interlagos: 'NOR', vegas: 'LEC', yas_marina: 'TSU',
 },
 2024: {
  bahrain: 'SAI', jeddah: 'BEA', albert_park: 'SAI', suzuka: 'LEC', shanghai: 'NOR',
  miami: 'NOR', imola: 'NOR', monaco: 'LEC', villeneuve: 'NOR', catalunya: 'NOR',
  red_bull_ring: 'NOR', silverstone: 'HAM', hungaroring: 'PIA', spa: 'HAM',
  zandvoort: 'NOR', monza: 'LEC', baku: 'PIA', marina_bay: 'RIC', americas: 'LEC',
  rodriguez: 'SAI', interlagos: 'VER', vegas: 'HAM', losail: 'ZHO', yas_marina: 'LEC',
 },
 2025: {
  albert_park: 'NOR', shanghai: 'ANT', suzuka: 'TSU', bahrain: 'HAM', jeddah: 'VER',
  miami: 'PIA', imola: 'VER', monaco: 'LEC', catalunya: 'VER', villeneuve: 'ANT',
  red_bull_ring: 'BOR', silverstone: 'HUL', spa: 'HAM', hungaroring: 'BOR',
  zandvoort: 'HAD', monza: 'VER', baku: 'SAI', marina_bay: 'ALO', americas: 'LEC',
  rodriguez: 'BEA', interlagos: 'VER', vegas: 'VER', losail: 'VER', yas_marina: 'VER',
 },
 // 2026 results published through Mexico City, verified 2026-11-07.
 2026: {
  albert_park: 'VER', shanghai: 'ANT', suzuka: 'PIA', miami: 'VER', villeneuve: 'HAM',
  monaco: 'ANT', catalunya: 'HAM', red_bull_ring: 'VER', silverstone: 'LEC', spa: 'LEC',
  hungaroring: 'VER', zandvoort: 'NOR', monza: 'ANT', madring: 'VER', baku: 'VER',
  sepang: 'VER', marina_bay: 'VER', americas: 'LEC', rodriguez: 'VER',
 },
};

export function driverOfTheDay(race) {
 const {season, circuit, results} = race;
 const seasonWinners = winners[season];
 if (!seasonWinners || !Object.hasOwn(seasonWinners, circuit.id)) return null;
 const abbreviation = seasonWinners[circuit.id];
 return {
  driver: results.find(row => row.driver.abbreviation === abbreviation)?.driver ?? {name: abbreviation},
  source: `https://www.formula1.com/en/results/${season}/awards/driver-of-the-day`,
 };
}
