// Address / PIN code lookup via OpenStreetMap Nominatim (same service the website uses).
// Nominatim's usage policy requires an identifying User-Agent.

export interface GeoResult {
  lat: number;
  lng: number;
  location: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export async function geocode(searchValue: string): Promise<GeoResult | null> {
  const v = searchValue.trim();
  if (!v) return null;
  const q = /^\d{5,6}$/.test(v) ? `${v}, India` : v;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { 'User-Agent': 'BandookwaleApp/1.0 (https://bandookwale.com)', Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error('Error fetching location.');
  const list = await res.json();
  const r = Array.isArray(list) ? list[0] : null;
  if (!r) return null;
  const a = r.address ?? {};
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    location: r.display_name ?? v,
    city: a.city || a.town || a.village || a.county || '',
    state: a.state || '',
    zipCode: a.postcode || (/^\d{6}$/.test(v) ? v : ''),
    country: a.country || 'India',
  };
}
