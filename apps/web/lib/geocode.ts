/**
 * Geocoder query planning (ASH-268 follow-up).
 *
 * Open-Meteo matches place names literally and requires the FULL country
 * name: "Los Angeles, USA", "London, UK" and "New York, USA" all return
 * zero results, while "Los Angeles, United States" resolves. Real people
 * type the short form, so the route expands the common abbreviations and
 * then falls back to progressively shorter queries rather than telling
 * the user their city does not exist.
 *
 * Ordering is deliberate: "Springfield, Illinois" is a better guess than
 * "Springfield, United States", so a region beats a country when both are
 * present. The user's raw query always goes first — if they typed
 * something the provider understands, we never second-guess them.
 */

/**
 * Short/informal country forms → the name Open-Meteo indexes. Keys are
 * compared with dots and case removed ("U.S.A." → "usa").
 */
const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  gb: "United Kingdom",
  "great britain": "United Kingdom",
  uae: "United Arab Emirates",
};

function cleanPart(part: string): string {
  return part.replace(/\s+/g, " ").replace(/\.+$/, "").trim();
}

/** Expand a short country form; unknown values pass through unchanged. */
export function expandCountry(value: string): string {
  const cleaned = cleanPart(value);
  const key = cleaned.toLowerCase().replace(/\./g, "");
  return COUNTRY_ALIASES[key] ?? cleaned;
}

/**
 * Candidate queries to try in order, most specific first, without
 * duplicates. Always returns at least one entry for non-empty input.
 */
export function candidateQueries(raw: string): string[] {
  const parts = raw
    .split(",")
    .map(cleanPart)
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (query: string) => {
    const cleaned = cleanPart(query);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  if (parts.length === 0) return out;

  // 1. Exactly what the user typed.
  push(parts.join(", "));

  const first = parts[0];
  const last = parts[parts.length - 1];

  // 2. City + region ("Los Angeles, California") — more precise than
  //    city + country when a region is present.
  if (parts.length >= 3) push(`${first}, ${parts[1]}`);

  // 3. City + expanded country ("Los Angeles, USA" → United States).
  if (parts.length >= 2) push(`${first}, ${expandCountry(last)}`);

  // 4. Progressively drop trailing qualifiers.
  for (let end = parts.length - 1; end >= 1; end -= 1) {
    push(parts.slice(0, end).join(", "));
  }

  // 5. Last resort: the place name alone.
  push(first);

  return out;
}
