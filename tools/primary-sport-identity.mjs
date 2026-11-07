// Shared sport/league identity for coverage, benchmark scope and feed health.
function normalizedText(...values) {
  return values.filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export const PROFESSIONAL_LEAGUE_IDENTITY_FROM='2026-11-07T20:10:00Z';
export function majorSportKey(event,{at}={}) {
  const sport = normalizedText(event?.sport?.slug || event?.identity?.sportKey || event?.sport?.name);
  const leagueSlug = normalizedText(event?.league?.slug || event?.identity?.leagueKey);
  const league = normalizedText(event?.league?.slug, event?.league?.name, event?.identity?.leagueKey);
  // Preserve original inventory reproduction for issued reports. New intake
  // must not identify the NBA development league as the NBA first team league.
  if(sport==='basketball' && /\b(?:nba g league|g league|development league)\b/.test(league) &&
    (!Number.isFinite(Date.parse(at||'')) || Date.parse(at)>=Date.parse(PROFESSIONAL_LEAGUE_IDENTITY_FROM)))return null;
  if (sport === 'baseball' && (leagueSlug === 'usa mlb' || /\bmlb\b|major league baseball/.test(league))) return 'MLB';
  if (sport === 'ice hockey' && (leagueSlug === 'usa nhl' || /\bnhl\b|national hockey league/.test(league))) return 'NHL';
  if (sport === 'basketball' && (['usa nba', 'usa wnba'].includes(leagueSlug) || /\bnba\b|\bwnba\b|national basketball association/.test(league))) return 'NBA_WNBA';
  if (sport !== 'american football') return null;
  if (leagueSlug === 'usa nfl' || /\bnfl\b|national football league/.test(league)) return 'NFL';
  if (['usa college', 'usa ncaaf'].includes(leagueSlug) || /\bncaaf\b|\bncaa\b|college/.test(league)) return 'NCAAF';
  if (['canada cfl', 'canadian football league'].includes(leagueSlug) || /\bcfl\b|canadian football league/.test(league)) return 'CFL';
  return null;
}
