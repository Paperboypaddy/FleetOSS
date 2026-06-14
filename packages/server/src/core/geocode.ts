export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FleetOSS/1.0' },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json() as any
    if (!data?.address) return null
    const a = data.address
    const street = [a.house_number, a.road, a.pedestrian].filter(Boolean).join(' ')
    const city = a.city || a.town || a.village || a.municipality || ''
    if (street && city) return `${street}, ${city}`
    if (city) return city
    return data.display_name?.split(',').slice(0, 2).join(',') || null
  } catch {
    return null
  }
}
