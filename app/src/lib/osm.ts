export async function fetchOSRMRoute(waypoints: [number, number][]) {
  const coords = waypoints.map(w => `${w[1]},${w[0]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') return null;
  return data.routes[0];
}
