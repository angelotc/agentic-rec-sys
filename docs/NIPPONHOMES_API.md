# Nipponhomes Hackathon Partner API

## Base URL

```text
https://nipponhomes.com
```

## API Key

Use the partner API key through the `x-api-key` header.

Server env supports both a legacy single key and multiple comma-separated keys:

```env
PARTNER_API_KEY=existing_partner_key
PARTNER_API_KEYS=<YOUR_API_KEY>,another_partner_key
```

### macOS/Linux

```bash
export NIPPONHOMES_API_KEY="<YOUR_API_KEY>"
export NIPPONHOMES_API_BASE_URL="https://nipponhomes.com"
```

### PowerShell

```powershell
$env:NIPPONHOMES_API_KEY = "<YOUR_API_KEY>"
$env:NIPPONHOMES_API_BASE_URL = "https://nipponhomes.com"
```

## Converted Partner API Endpoints

### 1. Combined Recent Listing Activity From The Last 24 Hours

Returns both new listings and price drops with the same fields. Use `category` to distinguish rows and `event_at` for the activity timestamp.

```http
GET /api/listings/recent-activity?limit=50
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/recent-activity?limit=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

Each listing has:

```ts
listing_id: string
category: "new_listing" | "price_drop"
event_at: string
title: string | null
title_english: string | null
price: string | null
previous_price: string | null
change_amount: string | null
change_percentage: string | null
price_changed_at: string | null
first_seen: string | null
scraped_at: string | null
last_seen: string | null
location: string | null
location_english: string | null
city_en: string | null
prefecture_en: string | null
listing_type: string | null
listing_type_en: string | null
listing_url: string | null
lat: number | null
lng: number | null
images: string[] // generated CloudFront URLs
```

Pagination:

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/recent-activity?limit=50&offset=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 2. Latest Scraped Listings From The Last 24 Hours

```http
GET /api/listings/latest-scraped?limit=50
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/latest-scraped?limit=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

Each listing has:

```ts
category: "new_listing"
images: string[] // generated CloudFront URLs
```

Pagination:

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/latest-scraped?limit=50&offset=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 3. Latest Price Drops From The Last 24 Hours

```http
GET /api/listings/price-drops?limit=50
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/price-drops?limit=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

Each listing has:

```ts
category: "price_drop"
images: string[] // generated CloudFront URLs
previous_price
change_amount
change_percentage
```

Pagination:

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/price-drops?limit=50&offset=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 4. Favorite Listings For A User

Returns the same feed-style listing schema, with `category: "favorite"` and favorite-specific metadata.

```http
GET /api/listings/favorites/USER_UUID?limit=50
```

```powershell
Invoke-RestMethod `
  -Uri "$env:NIPPONHOMES_API_BASE_URL/api/listings/favorites/USER_UUID?limit=50" `
  -Headers @{ "x-api-key" = $env:NIPPONHOMES_API_KEY } |
  ConvertTo-Json -Depth 10
```

Each favorite listing has:

```ts
category: "favorite"
event_at: string
saved_at: string
notes: string | null
tags: string | null
price_usd: number | null
previous_price_usd: number | null
change_amount_usd: number | null
images: string[]
```

The worker exposes this as a tool capability:

```shell
ntn workers exec getNipponhomesFavorites --local -d '{"userUuid":"USER_UUID"}'
```

### 5. Aggregate Location Insights

```http
GET /api/location-insights/by-location?lat=35.6895&lng=139.6917
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/location-insights/by-location?lat=35.6895&lng=139.6917" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 6. Market Analytics By Location

```http
GET /api/analytics/by-location?lat=35.6895&lng=139.6917&listing_type=House
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/analytics/by-location?lat=35.6895&lng=139.6917&listing_type=House" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 7. Market Analytics By JIS Code

```http
GET /api/analytics/by-jis?jis_code=13104
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/analytics/by-jis?jis_code=13104" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 8. Market Analytics Map Overlay

```http
GET /api/analytics/ordinance?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/analytics/ordinance?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 9. Airbnb Market By Location

```http
GET /api/airbnb-insights/markets/by-location?lat=35.6895&lng=139.6917
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/airbnb-insights/markets/by-location?lat=35.6895&lng=139.6917" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 10. Airbnb Market Map Overlay

```http
GET /api/airbnb-insights/markets?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/airbnb-insights/markets?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 11. Market Comparables

```http
GET /api/comparables?listingId=LISTING_ID
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/comparables?listingId=LISTING_ID" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

## Already Protected By The Same Partner API Key

### 12. Listing Details

```http
GET /api/listings/LISTING_ID
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/LISTING_ID" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 13. Nearby Listings

```http
GET /api/listings/nearby?lat=35.6895&lng=139.6917&limit=20
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/nearby?lat=35.6895&lng=139.6917&limit=20" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

## Not Exposed

The following API groups should stay private because they involve accounts, payments, owner/admin workflows, saved user data, or write actions:

```text
/api/admin/*
/api/auth/*
/api/my-*
/api/notifications/*
/api/owner/*
/api/saved-*
/api/stripe/*
/api/user/*
```
