// Shared party list — used by signup and by profile setup, so the two screens
// cannot drift apart. The `name` is what gets stored on the user and is later
// matched against the backend tenant registry (see backend/config/tenants.json).
export const POLITICAL_PARTIES = [
  { name: 'Indian National Congress (INC)',      logo: '/party-logos/inc.png' },
  { name: 'Trinamool Congress (TMC)',             logo: '/party-logos/tmc.png' },
  { name: 'Communist Party of India (CPI)',       logo: '/party-logos/cpi.png' },
  { name: 'Samajwadi Party (SP)',                 logo: '/party-logos/sp.png' },
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
