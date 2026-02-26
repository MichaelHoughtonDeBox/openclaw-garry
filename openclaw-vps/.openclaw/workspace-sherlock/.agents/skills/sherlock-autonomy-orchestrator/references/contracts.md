# Sherlock Skill Contracts

Use these contracts as the canonical input/output shape across Sherlock skills.
Keep keys stable so heartbeat automation, smoke tests, and task orchestration stay deterministic.

## 1) `sherlock-task-intake`

### Input

```json
{
  "taskId": "optional-mission-control-task-id",
  "taskName": "Investigate lead URL",
  "description": "Task brief text from Mission Control",
  "focusLocations": ["Johannesburg, South Africa", "London, United Kingdom"],
  "defaultMinIncidents": 3,
  "defaultMaxPasses": 2
}
```

### Output

```json
{
  "mode": "directed",
  "leadUrls": ["https://example.com/article"],
  "leadTexts": ["normalized lead snippets"],
  "focusLocations": ["Johannesburg, South Africa"],
  "queryPlan": {
    "xQuery": "(robbery OR assault) has:geo -is:retweet lang:en",
    "perplexityQueries": [
      "Find corroborating incidents near Johannesburg, South Africa."
    ],
    "queryFamily": "task_hypothesis"
  },
  "runConfig": {
    "minIncidents": 2,
    "maxPasses": 2
  },
  "notes": ["human-readable parser notes for logs/docs"]
}
```

## 2) `sherlock-source-collection`

### Input

```json
{
  "state": {
    "connectors": {
      "x_api": {
        "sinceId": "123"
      },
      "perplexity_web": {
        "lastRunAt": "2026-01-01T00:00:00.000Z"
      }
    }
  },
  "limit": 25,
  "mode": "autonomous",
  "pass": 1,
  "focusLocations": ["Johannesburg, South Africa"],
  "overrides": {
    "xQuery": "",
    "perplexityQueries": []
  },
  "strategy": {
    "focusRotationIndex": 0,
    "randomSeed": 0.33,
    "lastSuccessfulQueryFamilies": []
  }
}
```

### Output

```json
{
  "plan": {
    "pass": 1,
    "mode": "autonomous",
    "focusLocations": ["Johannesburg, South Africa"],
    "xQuery": "(crime OR robbery OR assault OR \"suspicious activity\") has:geo -is:retweet lang:en",
    "perplexityQueries": [
      "Find recent suspicious activity or crime incident reports from x.com and local news."
    ],
    "queryFamily": "default"
  },
  "results": [
    {
      "connector": "x_api",
      "candidates": [],
      "checkpoint": {},
      "meta": {},
      "warnings": []
    }
  ],
  "errors": [],
  "candidates": []
}
```

## 3) `sherlock-incident-enrichment`

### Input

```json
{
  "candidates": [],
  "previousFingerprints": [],
  "quality": {
    "minSummaryLength": 24,
    "requireSourceIdentity": true
  }
}
```

### Output

```json
{
  "normalizedIncidents": [],
  "rejected": [
    {
      "sourceId": "abc",
      "reason": "missing_or_invalid_coordinates"
    }
  ],
  "dedupe": {
    "raw": 12,
    "keptWithinRun": 9,
    "droppedWithinRun": 2,
    "droppedCrossCycle": 1
  },
  "geocoding": {
    "successfulFallbacks": 1,
    "unresolvedCandidates": 2
  },
  "newFingerprints": ["x:1234567890"]
}
```

## 4) `sherlock-wolf-submission`

### Input

```json
{
  "incidents": [],
  "dryRun": true
}
```

### Output

```json
{
  "submission": {
    "submitted": 0,
    "accepted": 0,
    "duplicates": 0,
    "failed": 0,
    "dryRun": true
  },
  "submissionError": null
}
```

## 5) `sherlock-geocode-resolution`

### Input

```json
{
  "resolutionType": "forward",
  "locationLabel": "Brixton, Johannesburg",
  "latitude": null,
  "longitude": null
}
```

### Output

```json
{
  "ok": true,
  "resolutionType": "forward",
  "latitude": -26.1922,
  "longitude": 27.9856,
  "label": "Brixton, Johannesburg, Gauteng, South Africa",
  "provider": "here",
  "confidence": "high",
  "evidenceUrl": "https://geocode.search.hereapi.com/v1/geocode?...",
  "notes": []
}
```

## 6) Agentic candidate payload (tool-driven discovery output)

### Input

```json
{
  "meta": {
    "queryFamily": "task_hypothesis"
  },
  "candidates": [
    {
      "sourcePlatform": "web",
      "sourceId": "stable-source-id",
      "sourceUrl": "https://example.com/source",
      "author": "Publisher name",
      "postedAt": "2026-02-16T10:30:00.000Z",
      "summary": "Short but complete incident summary.",
      "rawText": "Longer evidence text for type inference and traceability.",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "locationLabel": "Johannesburg, South Africa",
      "connector": "agentic-tools",
      "keywords": ["robbery"],
      "severity": 3
    }
  ]
}
```

## 7) `sherlock-autonomy-orchestrator` finalizer (`finalize-agentic-cycle.mjs`)

### Input

```json
{
  "inputFile": "/tmp/sherlock-candidates-1234.json",
  "mode": "autonomous",
  "taskId": null,
  "queryFamily": "crime_watch",
  "dryRun": true
}
```

### Output

```json
{
  "startedAt": "2026-01-01T00:00:00.000Z",
  "finishedAt": "2026-01-01T00:00:10.000Z",
  "mode": "autonomous",
  "taskId": null,
  "dryRun": true,
  "queryFamily": "crime_watch",
  "candidateCounts": {
    "raw": 8,
    "deduped": 6,
    "droppedWithinRun": 1,
    "droppedCrossCycle": 1
  },
  "normalization": {
    "accepted": 4,
    "rejected": 2,
    "rejectedDetails": []
  },
  "geocoding": {
    "successfulFallbacks": 1,
    "unresolvedCandidates": 0
  },
  "submission": {
    "submitted": 4,
    "accepted": 0,
    "duplicates": 0,
    "failed": 0,
    "dryRun": true
  },
  "submissionError": null
}
```
