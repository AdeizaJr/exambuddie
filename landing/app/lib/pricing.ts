// Server-side pricing fetch: reads the admin-configured prices from the backend.
// Falls back to defaults if the backend is unreachable so the landing page never breaks.
export interface PricingData {
  monthly_ngn: number;
  term_ngn: number;
  yearly_ngn: number;
}

const DEFAULTS: PricingData = {
  monthly_ngn: 1500,
  term_ngn: 3500,
  yearly_ngn: 12000,
};

export async function getPricing(): Promise<PricingData> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return DEFAULTS;
  try {
    const res = await fetch(`${apiUrl}/api/pricing`, { next: { revalidate: 300 } });
    if (!res.ok) return DEFAULTS;
    return await res.json();
  } catch {
    return DEFAULTS;
  }
}
