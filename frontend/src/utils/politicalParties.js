// Shared party list — used by signup and by profile setup, so the two screens
// cannot drift apart. The `name` is what gets stored on the user and is later
// matched against the backend tenant registry (see backend/config/tenants.json).
//
// `available` is whether we hold a corpus for that party yet. Only Congress and
// Samajwadi have transcripts, a knowledge graph and role vocabulary, so only
// those two are offered. The rest stay listed rather than deleted: accounts
// already carry these names, and removing a row would leave those users showing
// a blank party and no logo.
export const ALL_POLITICAL_PARTIES = [
  { name: 'Indian National Congress (INC)',      logo: '/party-logos/inc.png', available: true },
  { name: 'Trinamool Congress (TMC)',             logo: '/party-logos/tmc.png' },
  { name: 'Communist Party of India (CPI)',       logo: '/party-logos/cpi.png' },
  { name: 'Samajwadi Party (SP)',                 logo: '/party-logos/sp.png', available: true },
  { name: 'Aam Aadmi Party (AAP)',               logo: '/party-logos/aap.png' },
  { name: 'Bahujan Samaj Party (BSP)',           logo: '/party-logos/bsp.png' },
  { name: 'Rashtriya Janata Dal (RJD)',          logo: '/party-logos/rjd.png' },
  { name: 'Janata Dal (Loktantrik)',             logo: '/party-logos/jdl.png' },
  { name: 'Azad Samaj Party',                    logo: '/party-logos/azad-samaj.png' },
  { name: 'Jan Suraaj Party',                    logo: '/party-logos/jan-suraaj.png' },
  { name: 'Vikassheel Insaan Party (VIP)',       logo: '/party-logos/vip.png' },
  { name: 'Indian National Lok Dal (INLD)',      logo: '/party-logos/inld.png' },
  { name: 'Jannayak Janta Party (JJP)',          logo: '/party-logos/jjp.png' },
  { name: 'Bharat Adivasi Party (BAP)',          logo: '/party-logos/bap.png' },
  { name: 'None / Not Affiliated',               logo: null },
];

// What the pickers offer. Import this, not ALL_POLITICAL_PARTIES, unless you
// specifically need to resolve a party a user already has.
export const POLITICAL_PARTIES = ALL_POLITICAL_PARTIES.filter((p) => p.available);

// Resolve any stored party name, including ones no longer offered, so an
// existing account still renders its own logo.
export function findParty(name) {
  if (!name) return null;
  return ALL_POLITICAL_PARTIES.find((p) => p.name === name) || null;
}

export function partyLogo(name) {
  return findParty(name)?.logo || null;
}
