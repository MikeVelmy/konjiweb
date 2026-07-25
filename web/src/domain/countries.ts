/**
 * Country registry driving the matching-mode gate.
 *
 * `sameGenderMatching` is a POLICY input, not a product preference: it reflects
 * whether the app is permitted to offer same-gender pairing in that jurisdiction.
 * Every entry here must be reviewed by counsel before it ships, and no country
 * should be flipped to `launched: true` until that review has happened. The gate
 * is enforced server-side too (see supabase/migrations) — this table only drives
 * what the UI offers, and a client is never the security boundary.
 */

export type Country = {
  code: string;
  name: string;
  flag: string;
  /** Whether same-gender pairing may legally be offered here. */
  sameGenderMatching: boolean;
  /** v1 ships to Ghana only; the rest are here to prove the gate works. */
  launched: boolean;
};

export const countries: Country[] = [
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', sameGenderMatching: false, launched: true },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', sameGenderMatching: false, launched: false },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', sameGenderMatching: false, launched: false },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', sameGenderMatching: true, launched: false },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', sameGenderMatching: true, launched: false },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', sameGenderMatching: true, launched: false },
  { code: 'US', name: 'United States', flag: '🇺🇸', sameGenderMatching: true, launched: false },
];

export const DEFAULT_COUNTRY = 'GH';

export function getCountry(code: string): Country | undefined {
  return countries.find((c) => c.code === code);
}

export function allowsSameGenderMatching(code: string): boolean {
  return getCountry(code)?.sameGenderMatching ?? false;
}
