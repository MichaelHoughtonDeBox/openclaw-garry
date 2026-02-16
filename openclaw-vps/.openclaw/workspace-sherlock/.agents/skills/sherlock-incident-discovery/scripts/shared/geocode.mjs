import { fetchJsonWithTimeout } from "./http.mjs";

function toFinite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinatePairFromText(rawText) {
  const text = String(rawText || "");
  // Detect explicit coordinate mentions like "-26.1453, 28.0902".
  const match = text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!match) {
    return null;
  }
  const first = toFinite(match[1]);
  const second = toFinite(match[2]);
  if (first === null || second === null) {
    return null;
  }

  // Choose ordering that yields valid lat/lon ranges.
  const asLatLon = Math.abs(first) <= 90 && Math.abs(second) <= 180;
  const asLonLat = Math.abs(first) <= 180 && Math.abs(second) <= 90;
  if (asLatLon) {
    return { latitude: first, longitude: second, provider: "inline" };
  }
  if (asLonLat) {
    return { latitude: second, longitude: first, provider: "inline" };
  }
  return null;
}

async function geocodeViaHere(query, timeoutMs) {
  const apiKey = process.env.HERE_API_KEY || "";
  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({
    q: query,
    limit: "1",
    apiKey
  });
  const { response, json } = await fetchJsonWithTimeout(
    `https://geocode.search.hereapi.com/v1/geocode?${params.toString()}`,
    { method: "GET" },
    timeoutMs
  );
  if (!response.ok) {
    return null;
  }

  const item = Array.isArray(json?.items) ? json.items[0] : null;
  if (!item?.position) {
    return null;
  }
  const latitude = toFinite(item.position.lat);
  const longitude = toFinite(item.position.lng);
  if (latitude === null || longitude === null) {
    return null;
  }
  return {
    latitude,
    longitude,
    label: item.address?.label || query,
    provider: "here"
  };
}

async function geocodeViaNominatim(query, timeoutMs) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1"
  });
  const { response, json } = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "User-Agent": "SherlockIncidentDiscovery/1.0"
      }
    },
    timeoutMs
  );
  if (!response.ok) {
    return null;
  }
  const item = Array.isArray(json) ? json[0] : null;
  if (!item) {
    return null;
  }

  const latitude = toFinite(item.lat);
  const longitude = toFinite(item.lon);
  if (latitude === null || longitude === null) {
    return null;
  }
  return {
    latitude,
    longitude,
    label: item.display_name || query,
    provider: "nominatim"
  };
}

export async function resolveCoordinatesFromText(rawText, options = {}) {
  const timeoutMs = Math.max(2000, Number(options.timeoutMs || process.env.SHERLOCK_GEOCODE_TIMEOUT_MS || 8000));
  const text = String(rawText || "").trim();
  if (!text) {
    return null;
  }

  // Fast path: explicit coordinates embedded in evidence text.
  const inline = parseCoordinatePairFromText(text);
  if (inline) {
    return inline;
  }

  const hereResult = await geocodeViaHere(text, timeoutMs);
  if (hereResult) {
    return hereResult;
  }

  return geocodeViaNominatim(text, timeoutMs);
}
