#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "$ROOT_DIR/.env"
	set +a
fi

API_BASE_URL="${NIPPONHOMES_API_BASE_URL:-https://nipponhomes.com}"
LIMIT="${NIPPONHOMES_LISTINGS_LIMIT:-100}"
MIN_INTERVAL_MS="${NIPPONHOMES_PROFILE_MIN_INTERVAL_MS:-200}"

if [[ -z "${NIPPONHOMES_API_KEY:-}" ]]; then
	echo "NIPPONHOMES_API_KEY must be set in the environment or .env" >&2
	exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
	echo "curl is required" >&2
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "node is required" >&2
	exit 1
fi

now_ms() {
	node -e 'process.stdout.write(String(Date.now()))'
}

json_field() {
	local file="$1"
	local field="$2"
	node -e '
		const fs = require("fs");
		const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
		const field = process.argv[2];
		if (field === "count") process.stdout.write(String((data.listings ?? []).length));
		if (field === "hasMore") process.stdout.write(data.hasMore ? "true" : "false");
		if (field === "limit") process.stdout.write(String(data.meta?.limit ?? ""));
	' "$file" "$field"
}

profile_endpoint() {
	local label="$1"
	local path="$2"
	local offset=0
	local page=1
	local endpoint_count=0
	local endpoint_start_ms
	local last_start_ms=0
	endpoint_start_ms="$(now_ms)"

	echo
	echo "Endpoint: $label ($path)"
	printf "%-6s %-8s %-8s %-8s %-9s %-8s %-10s %-10s %-10s %-10s %s\n" \
		"page" "offset" "count" "status" "redirects" "gap_ms" "ttfb_s" "total_s" "bytes" "hasMore" "final_url"

	while true; do
		local before_sleep_ms
		before_sleep_ms="$(now_ms)"
		if (( last_start_ms > 0 )); then
			local since_last_ms=$((before_sleep_ms - last_start_ms))
			if (( since_last_ms < MIN_INTERVAL_MS )); then
				local sleep_ms=$((MIN_INTERVAL_MS - since_last_ms))
				sleep "$(node -e "process.stdout.write(String($sleep_ms / 1000))")"
			fi
		fi

		local start_ms
		start_ms="$(now_ms)"
		local gap_ms=0
		if (( last_start_ms > 0 )); then
			gap_ms=$((start_ms - last_start_ms))
		fi
		last_start_ms="$start_ms"

		local body_file
		body_file="$(mktemp)"
		local metrics
		local url="${API_BASE_URL%/}${path}?limit=${LIMIT}&offset=${offset}"
		metrics="$(
			curl -sS \
				-L \
				-H "x-api-key: $NIPPONHOMES_API_KEY" \
				-o "$body_file" \
				-w '%{http_code} %{num_redirects} %{time_starttransfer} %{time_total} %{size_download} %{url_effective}' \
				"$url"
		)"

		local status redirects ttfb_s total_s bytes final_url
		read -r status redirects ttfb_s total_s bytes final_url <<<"$metrics"

		if [[ "$status" != 2* ]]; then
			echo "Request failed for $url with HTTP $status" >&2
			echo "Response body:" >&2
			cat "$body_file" >&2
			rm -f "$body_file"
			exit 1
		fi

		local count has_more response_limit
		count="$(json_field "$body_file" count)"
		has_more="$(json_field "$body_file" hasMore)"
		response_limit="$(json_field "$body_file" limit)"
		rm -f "$body_file"

		endpoint_count=$((endpoint_count + count))

		printf "%-6s %-8s %-8s %-8s %-9s %-8s %-10s %-10s %-10s %-10s %s\n" \
			"$page" "$offset" "$count" "$status" "$redirects" "$gap_ms" "$ttfb_s" "$total_s" "$bytes" "$has_more" "$final_url"

		if [[ "$has_more" != "true" ]]; then
			break
		fi

		offset=$((offset + ${response_limit:-$LIMIT}))
		page=$((page + 1))
	done

	local endpoint_end_ms
	endpoint_end_ms="$(now_ms)"
	local endpoint_total_ms=$((endpoint_end_ms - endpoint_start_ms))
	echo "Endpoint total: ${endpoint_count} listings across ${page} pages in ${endpoint_total_ms}ms"
	TOTAL_COUNT=$((TOTAL_COUNT + endpoint_count))
	TOTAL_PAGES=$((TOTAL_PAGES + page))
}

TOTAL_COUNT=0
TOTAL_PAGES=0
RUN_START_MS="$(now_ms)"

echo "Profiling Nipponhomes listings API"
echo "Base URL: $API_BASE_URL"
echo "Limit: $LIMIT"
echo "Minimum request-start interval: ${MIN_INTERVAL_MS}ms"

profile_endpoint "new_listing" "/api/listings/latest-scraped"
profile_endpoint "price_drop" "/api/listings/price-drops"

RUN_END_MS="$(now_ms)"
RUN_TOTAL_MS=$((RUN_END_MS - RUN_START_MS))

echo
echo "Run total: ${TOTAL_COUNT} listings across ${TOTAL_PAGES} pages in ${RUN_TOTAL_MS}ms"
