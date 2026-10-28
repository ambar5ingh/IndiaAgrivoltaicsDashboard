// Agro-climatic conditions: Planning Commission agro-climatic region (ACR) for each district,
// Hargreaves reference evapotranspiration, aridity and length of growing period.
const has = (name, list) => list.some(x => name.toLowerCase().includes(x));

export function acrOf(d) {
  const n = d.d, st = d.st;
  switch (st) {
    case 'Jammu and Kashmir': case 'Ladakh': case 'Himachal Pradesh': return 1;
    case 'Uttarakhand': return has(n, ['haridwar', 'udham singh']) ? 5 : 1;
    case 'Sikkim': case 'Arunachal Pradesh': case 'Assam': case 'Meghalaya': case 'Nagaland': case 'Manipur': case 'Mizoram': case 'Tripura': return 2;
    case 'West Bengal':
      if (has(n, ['darjiling', 'kalimpong', 'jalpaiguri', 'alipur', 'koch'])) return 2;
      if (has(n, ['puruliya', 'jhargram'])) return 7;
      return 3;
    case 'Bihar': return 4;
    case 'Uttar Pradesh':
      if (has(n, ['jhansi', 'lalitpur', 'jalaun', 'hamirpur', 'mahoba', 'banda', 'chitrakoot', 'mirzapur', 'sonbhadra'])) return 8;
      return d.lon >= 81.5 ? 4 : 5;
    case 'Punjab': case 'Haryana': case 'Delhi': case 'Chandigarh': return 6;
    case 'Rajasthan':
      if (has(n, ['ganganagar', 'hanumangarh', 'anoopgarh'])) return 6;
      if (has(n, ['jaisalmer', 'barmer', 'balotra', 'bikaner', 'jodhpur', 'phalodi', 'churu', 'nagaur', 'didwana', 'jhunjhun', 'sikar', 'jalor', 'sanchore', 'pali'])) return 14;
      return 8;
    case 'Madhya Pradesh':
      if (has(n, ['balaghat', 'mandla', 'dindori', 'shahdol', 'anuppur', 'umaria', 'sidhi', 'singrauli'])) return 7;
      if (has(n, ['khandwa', 'burhanpur', 'khargone', 'barwani', 'alirajpur', 'betul', 'chhindwara', 'pandhurna'])) return 9;
      return 8;
    case 'Chhattisgarh': case 'Jharkhand': return 7;
    case 'Odisha':
      return has(n, ['balasore', 'bhadrak', 'kendrapara', 'jagatsinghpur', 'puri', 'khordha', 'cuttack', 'jajapur', 'ganjam']) ? 11 : 7;
    case 'Maharashtra':
      if (has(n, ['mumbai', 'thane', 'palghar', 'raigarh', 'ratnagiri', 'sindhudurg'])) return 12;
      if (has(n, ['gondia', 'bhandara', 'chandrapur', 'gadchiroli'])) return 7;
      return 9;
    case 'Gujarat': case 'Dadra & Nagar Haveli & Daman & Diu': return 13;
    case 'Goa': case 'Kerala': return 12;
    case 'Karnataka': return has(n, ['dakshina', 'udupi', 'uttara kannada', 'kodagu']) ? 12 : 10;
    case 'Tamil Nadu':
      if (has(n, ['nilgiris', 'kanniyakumari'])) return 12;
      if (has(n, ['chennai', 'thiruvallur', 'chengalpattu', 'kanchipuram', 'viluppuram', 'cuddalore', 'mayiladuthurai', 'nagapattinam', 'thiruvarur', 'thanjavur', 'pudukkottai', 'ramanathapuram', 'thoothukudi', 'tirunelveli'])) return 11;
      return 10;
    case 'Andhra Pradesh':
      if (has(n, ['kurnool', 'nandyal', 'ananthapuramu', 'sri sathya', 'kadapa', 'annamayya', 'chittoor'])) return 10;
      if (has(n, ['alluri', 'parvathipuram'])) return 7;
      return 11;
    case 'Telangana': return 10;
    case 'Puducherry': return n === 'Mahe' ? 12 : 11;
    case 'Andaman and Nicobar Islands': case 'Lakshadweep': return 15;
    default: return 10;
  }
}

const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Hargreaves (1975) radiation-based reference evapotranspiration, mm/month:
// ET0 = 0.0135 (T + 17.8) Rs / lambda, with Rs the district's NASA POWER solar radiation (MJ/m2/day)
export function petMonthly(d) {
  return d.tm.map((t, m) => Math.max(0, 0.0135 * (t + 17.8) * (d.ghim[m] * 3.6) / 2.45) * DAYS[m]);
}

// Aridity index (UNEP P/PET), moisture regime and length of growing period
export function agroClimate(d) {
  const pet = petMonthly(d);
  const P = d.rm;
  const PET = pet.reduce((a, b) => a + b, 0);
  const ai = PET > 0 ? d.rain / PET : 9;
  const cls = ai < 0.05 ? 'Hyper-arid' : ai < 0.2 ? 'Arid' : ai < 0.5 ? 'Semi-arid' : ai < 0.65 ? 'Dry sub-humid' : ai < 1 ? 'Moist sub-humid' : 'Humid';
  // growing period: months warmer than 5 °C with P >= 0.5 PET, plus up to 100 mm stored soil water carried into the following dry months
  let lgp = 0, store = 0;
  for (let pass = 0; pass < 2; pass++) {
    lgp = 0;
    for (let m = 0; m < 12; m++) {
      const need = 0.5 * pet[m];
      if (d.tm[m] < 5) { store = Math.min(100, store + P[m]); continue; } // too cold to grow; snow and rain recharge the soil
      if (P[m] >= need) { lgp += DAYS[m]; store = Math.min(100, store + Math.max(0, P[m] - pet[m])); }
      else if (store + P[m] >= need) { lgp += DAYS[m]; store = Math.max(0, store + P[m] - pet[m]); }
      else store = 0;
    }
  }
  const kharif = P[5] + P[6] + P[7] + P[8];
  const rabi = P[9] + P[10] + P[11] + P[0] + P[1] + P[2];
  const deficit = pet.reduce((s, e, m) => s + Math.max(0, e - P[m]), 0);
  return { pet, PET, ai, cls, lgp: Math.round(Math.min(365, lgp)), kharif, rabi, deficit };
}
