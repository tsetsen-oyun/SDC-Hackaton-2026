// The server (backend/engine/pages.js) already sends every page's data in the shape the pages read.
// Only the About page's source list needs a little tidying.
export function normalizeSources(manifest = {}, params = {}) {
  const assumptions = [];
  if (params.domain_discount != null)
    assumptions.push(`Domain discount: ${params.domain_discount}% (AI time-horizons are shortened for office work).`);
  if (params.adoption_delay_years != null)
    assumptions.push(`Adoption delay: ${params.adoption_delay_years} years between "AI can" and "firms do".`);
  return {
    ...manifest,
    snapshotDate: manifest.snapshotDate ?? manifest.snapshot_date,
    model: manifest.model ?? manifest.llm_model_used,
    sources: (manifest.sources ?? []).map((s) => ({
      label: s.label ?? s.name, url: s.url, date: s.date ?? s.date_taken, licence: s.licence,
    })),
    assumptions: manifest.assumptions ?? assumptions,
  };
}