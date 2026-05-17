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

Returns both new listings and price drops with the same fields. Use `category` to distinguish rows and `event_at` for the activity timestamp. Price drops only include listings discounted by more than 8%.

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
price_usd: number | null
previous_price: string | null
previous_price_usd: number | null
change_amount: string | null
change_amount_usd: number | null
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

USD fields are derived from the latest `USD` row in the `exchange_rates` table. JPY fields stay unchanged.

Pagination:

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/recent-activity?limit=50&offset=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

Use `offset` for subsequent pages.

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
price_usd: number | null
previous_price_usd: number | null
change_amount_usd: number | null
images: string[] // generated CloudFront URLs
```

Pagination:

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/latest-scraped?limit=50&offset=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 3. Latest Price Drops From The Last 24 Hours

Only includes listings discounted by more than 8%.

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
price_usd: number | null
previous_price_usd: number | null
change_amount_usd: number | null
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

### 4. Listing Price Per Sq Ft And Nearby Comparables

Returns the listing's converted price per sq ft plus comparable price per sq ft summaries inside 1 km and 2 km. The `currency` parameter defaults to `USD` and must exist in the `exchange_rates` table.

```http
GET /api/listings/LISTING_ID/price-per-sqft?currency=USD
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/LISTING_ID/price-per-sqft?currency=USD" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

Each response has:

```ts
listing: {
  listing_id: string
  title: string | null
  listing_type: string | null
  listing_type_en: string | null
  price_jpy: number
  price: number
  currency: string
  effective_size_sqm: number
  effective_size_sqft: number
  price_per_sqft_jpy: number
  price_per_sqft: number
}
comparables: Array<{
  radius_km: 1 | 2
  count: number
  active_count: number
  avg_price_per_sqft: number | null
  median_price_per_sqft: number | null
  min_price_per_sqft: number | null
  max_price_per_sqft: number | null
}>
```

Unsupported currency example:

```json
{
  "error": "Unsupported currency: XYZ",
  "detail": "Requested currency must exist in the exchange_rates table."
}
```

### 5. Favorite Listings For A User UUID

Returns the user's saved/favorited listings with the same listing feed fields. `event_at` is the favorite timestamp.

```http
GET /api/listings/favorites/USER_UUID?limit=50
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/favorites/USER_UUID?limit=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

Each listing has:

```ts
listing_id: string
category: "favorite"
event_at: string
saved_at: string
notes: string | null
tags: string | null
price_usd: number | null
previous_price_usd: number | null
change_amount_usd: number | null
images: string[] // generated CloudFront URLs
```

Pagination:

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/favorites/USER_UUID?limit=50&offset=50" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 6. Aggregate Location Insights

```http
GET /api/location-insights/by-location?lat=35.6895&lng=139.6917
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/location-insights/by-location?lat=35.6895&lng=139.6917" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 7. Market Analytics By Location

```http
GET /api/analytics/by-location?lat=35.6895&lng=139.6917&listing_type=House
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/analytics/by-location?lat=35.6895&lng=139.6917&listing_type=House" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 8. Market Analytics By JIS Code

```http
GET /api/analytics/by-jis?jis_code=13104
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/analytics/by-jis?jis_code=13104" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 9. Market Analytics Map Overlay

```http
GET /api/analytics/ordinance?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/analytics/ordinance?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 10. Airbnb Market By Location

```http
GET /api/airbnb-insights/markets/by-location?lat=35.6895&lng=139.6917
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/airbnb-insights/markets/by-location?lat=35.6895&lng=139.6917" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 11. Airbnb Market Map Overlay

```http
GET /api/airbnb-insights/markets?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/airbnb-insights/markets?minLat=35.60&maxLat=35.75&minLng=139.60&maxLng=139.85" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 12. Market Comparables

```http
GET /api/comparables?listingId=LISTING_ID
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/comparables?listingId=LISTING_ID" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

## Already Protected By The Same Partner API Key

### 13. Listing Details

```http
GET /api/listings/LISTING_ID
```

```bash
curl -s "$NIPPONHOMES_API_BASE_URL/api/listings/LISTING_ID" \
  -H "x-api-key: $NIPPONHOMES_API_KEY"
```

### 14. Nearby Listings

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