import { ConnectorBase } from "../base/connector-base.mjs";
import { fetchJsonWithTimeout } from "../../shared/http.mjs";
import { applyFocusToXQuery, parseFocusLocations } from "../../shared/focus.mjs";

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function maxSnowflakeId(ids) {
  if (!ids.length) {
    return null;
  }
  return ids.reduce((maxValue, current) => {
    const currentBigInt = BigInt(current);
    return currentBigInt > maxValue ? currentBigInt : maxValue;
  }, BigInt(ids[0])).toString();
}

function extractCoordinates(tweet, placeById) {
  const directCoordinates = tweet?.geo?.coordinates?.coordinates;
  if (Array.isArray(directCoordinates) && directCoordinates.length === 2) {
    const longitude = toFiniteNumber(directCoordinates[0]);
    const latitude = toFiniteNumber(directCoordinates[1]);
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude, locationLabel: null };
    }
  }

  const placeId = tweet?.geo?.place_id;
  if (!placeId || !placeById.has(placeId)) {
    return { latitude: null, longitude: null, locationLabel: null };
  }

  const place = placeById.get(placeId);
  const bbox = place?.geo?.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    return { latitude: null, longitude: null, locationLabel: place?.full_name || place?.name || null };
  }

  // HERE + Mongo use point coordinates, so we approximate place bbox with its centroid.
  const [west, south, east, north] = bbox.map(toFiniteNumber);
  if ([west, south, east, north].some((value) => value === null)) {
    return { latitude: null, longitude: null, locationLabel: place?.full_name || place?.name || null };
  }

  return {
    latitude: Number(((south + north) / 2).toFixed(6)),
    longitude: Number(((west + east) / 2).toFixed(6)),
    locationLabel: place?.full_name || place?.name || null
  };
}

function extractKeywords(text) {
  const lowered = String(text || "").toLowerCase();
  const dictionary = [
    "robbery",
    "theft",
    "assault",
    "shooting",
    "stabbing",
    "burglary",
    "carjacking",
    "suspicious",
    "vandalism",
    "fire"
  ];
  return dictionary.filter((keyword) => lowered.includes(keyword));
}

function inferSeverity(publicMetrics) {
  if (!publicMetrics) {
    return null;
  }

  const likeCount = Number(publicMetrics.like_count || 0);
  const repostCount = Number(publicMetrics.retweet_count || 0);
  const replyCount = Number(publicMetrics.reply_count || 0);
  const score = likeCount + repostCount * 2 + replyCount;

  if (score >= 500) return 5;
  if (score >= 200) return 4;
  if (score >= 80) return 3;
  if (score >= 20) return 2;
  return 1;
}

export class XApiConnector extends ConnectorBase {
  constructor(options = {}) {
    super("x_api");
    this.bearerToken = options.bearerToken || process.env.SHERLOCK_X_BEARER_TOKEN || "";
    this.baseQuery =
      options.query ||
      process.env.SHERLOCK_X_QUERY ||
      '(crime OR robbery OR assault OR "suspicious activity") has:geo -is:retweet lang:en';
    this.focusLocations = Array.isArray(options.focusLocations)
      ? options.focusLocations.map((value) => String(value).trim()).filter(Boolean)
      : parseFocusLocations(options.focusLocationsRaw || process.env.SHERLOCK_FOCUS_LOCATIONS || "");
    this.query = applyFocusToXQuery(this.baseQuery, this.focusLocations);
    this.maxResults = Math.max(10, Math.min(Number(options.maxResults || process.env.SHERLOCK_X_MAX_RESULTS || 25), 100));
    this.timeoutMs = Math.max(2000, Number(options.timeoutMs || process.env.SHERLOCK_X_TIMEOUT_MS || 15000));
    this.apiUrl = options.apiUrl || process.env.SHERLOCK_X_API_URL || "https://api.x.com/2/tweets/search/recent";
  }

  async collect({ state }) {
    const warnings = [];
    const nowIso = new Date().toISOString();

    if (!this.bearerToken) {
      warnings.push("SHERLOCK_X_BEARER_TOKEN is missing; skipping X connector.");
      return {
        connector: this.connectorName,
        candidates: [],
        checkpoint: { ...state?.connectors?.x_api, lastRunAt: nowIso },
        meta: { focusLocations: this.focusLocations, query: this.query },
        warnings
      };
    }

    const previousSinceId = state?.connectors?.x_api?.sinceId || null;
    const params = new URLSearchParams({
      query: this.query,
      "tweet.fields": "created_at,author_id,geo,public_metrics,text",
      expansions: "author_id,geo.place_id",
      "user.fields": "id,name,username",
      "place.fields": "id,name,full_name,country,country_code,geo",
      max_results: String(this.maxResults)
    });
    if (previousSinceId) {
      params.set("since_id", previousSinceId);
    }

    const { response, json } = await fetchJsonWithTimeout(
      `${this.apiUrl}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.bearerToken}`
        }
      },
      this.timeoutMs
    );

    if (!response.ok) {
      throw new Error(`X API request failed with status ${response.status}`);
    }

    const tweets = Array.isArray(json?.data) ? json.data : [];
    const includesUsers = Array.isArray(json?.includes?.users) ? json.includes.users : [];
    const includesPlaces = Array.isArray(json?.includes?.places) ? json.includes.places : [];

    const usersById = new Map(includesUsers.map((user) => [user.id, user]));
    const placesById = new Map(includesPlaces.map((place) => [place.id, place]));

    const candidates = tweets.map((tweet) => {
      const coordinates = extractCoordinates(tweet, placesById);
      const author = usersById.get(tweet.author_id);
      const rawText = String(tweet.text || "").trim();
      return {
        connector: this.connectorName,
        sourcePlatform: "x",
        sourceId: String(tweet.id),
        sourceUrl: `https://x.com/i/web/status/${tweet.id}`,
        summary: rawText.slice(0, 280),
        rawText,
        author: author?.username || author?.name || null,
        postedAt: tweet.created_at || null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        locationLabel: coordinates.locationLabel,
        keywords: extractKeywords(rawText),
        severity: inferSeverity(tweet.public_metrics),
        virality: {
          likes: Number(tweet.public_metrics?.like_count || 0),
          reposts: Number(tweet.public_metrics?.retweet_count || 0),
          replies: Number(tweet.public_metrics?.reply_count || 0),
          views: Number(tweet.public_metrics?.impression_count || 0)
        },
        collectedAt: nowIso
      };
    });

    if (!candidates.length) {
      warnings.push("X connector returned no new tweets.");
    }

    const nextSinceId = maxSnowflakeId(
      [previousSinceId, ...tweets.map((tweet) => String(tweet.id))].filter(Boolean)
    );

    return {
      connector: this.connectorName,
      candidates,
      checkpoint: {
        sinceId: nextSinceId,
        lastRunAt: nowIso
      },
      meta: { focusLocations: this.focusLocations, query: this.query },
      warnings
    };
  }
}
