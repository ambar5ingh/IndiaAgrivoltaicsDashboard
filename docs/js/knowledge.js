// Reference knowledge used by the dashboard: Köppen-Geiger classes, crop groups,
// system configurations, scenarios and the text behind every (i) button.
// Numbers are screening defaults drawn from the literature listed on the Sources page;
// every one of them can be changed from the levers panel.

// Köppen-Geiger classes. Colours follow the conventional Beck et al. (2018) legend.
// beta = shade co-benefit coefficient: how much yield partial shade recovers through lower heat and
// water stress (fraction of the light reduction). soil = soiling loss on modules.
export const KOPPEN = {
  Af:  { name: 'Tropical rainforest', color: '#0000ff', group: 'A', beta: 0.05, soil: 0.02,
    india: 'Small pockets of the Andaman & Nicobar Islands.',
    climate: 'Hot and wet all year, every month above 60 mm of rain.',
    config: 'elevated', gcr: [0.20, 0.30], height: '3.0–4.5 m', tiltAdj: -5,
    crops: ['spices', 'fruit', 'leafy'],
    notes: ['High diffuse light: keep GCR low and favour bifacial modules.', 'Corrosion-grade (C4/C5) structures on the coast.', 'Gutters or rain-spreading edges so drip lines under panels do not erode soil.'],
    risks: ['Cyclones and salt spray', 'Waterlogging', 'Low direct irradiance'] },
  Am:  { name: 'Tropical monsoon', color: '#0078ff', group: 'A', beta: 0.08, soil: 0.02,
    india: 'Konkan & Malabar coasts, Western Ghats, Kerala, Goa, parts of the North-East and coastal Bengal.',
    climate: 'Very heavy monsoon rain (often >2,500 mm) with a short dry season.',
    config: 'elevated', gcr: [0.20, 0.30], height: '3.0–4.5 m', tiltAdj: -5,
    crops: ['spices', 'fruit', 'leafy', 'plantation'],
    notes: ['Turmeric, ginger, black pepper and pineapple tolerate or prefer partial shade.', 'Design for heavy rain run-off: rain-spreading gaps between modules, drainage channels.', 'Monsoon wind and cyclone loads (IS 875 Part 3 zones) drive structure cost.'],
    risks: ['Heavy rain and run-off', 'Cyclones on the coast', 'Landslides on slopes', 'Low winter-monsoon irradiance'] },
  Aw:  { name: 'Tropical savanna (dry winter)', color: '#46aafa', group: 'A', beta: 0.25, soil: 0.03,
    india: 'Most of peninsular India: Telangana, Andhra Pradesh, Odisha, Chhattisgarh, Tamil Nadu interior, Vidarbha, south Gujarat, West Bengal.',
    climate: 'Hot, with a wet monsoon and a long dry, very hot pre-monsoon (Mar–May).',
    config: 'elevated', gcr: [0.25, 0.40], height: '3.0–4.0 m', tiltAdj: -3,
    crops: ['veg', 'leafy', 'spices', 'pulses', 'fruit', 'flowers'],
    notes: ['Shade cuts heat stress in Apr–May, when vegetables and pulses suffer most.', 'Elevated structures keep tractors and paddy-field puddling possible.', 'Harvest panel run-off for summer irrigation.'],
    risks: ['Pre-monsoon heat above 40 °C', 'Cyclones on the east coast', 'Seasonal flooding in deltas'] },
  As:  { name: 'Tropical savanna (dry summer)', color: '#8cc8ff', group: 'A', beta: 0.25, soil: 0.03,
    india: 'Coastal Tamil Nadu and parts of south Andhra, which get most rain from the north-east monsoon (Oct–Dec).',
    climate: 'Hot, with rain mainly in Oct–Dec and a dry summer.',
    config: 'elevated', gcr: [0.25, 0.40], height: '3.0–4.0 m', tiltAdj: -3,
    crops: ['veg', 'leafy', 'pulses', 'medicinal'],
    notes: ['Summer crops gain most from shade.', 'Cyclone-rated structures near the coast.'],
    risks: ['Cyclones (Oct–Dec)', 'Salt spray', 'Summer water scarcity'] },
  BWh: { name: 'Hot desert', color: '#ff0000', group: 'B', beta: 0.55, soil: 0.06,
    india: 'Thar desert: western Rajasthan (Jaisalmer, Barmer, Bikaner, Jodhpur), Kutch fringe.',
    climate: 'Under ~300 mm of rain, extreme summer heat (>45 °C), strong winds and dust.',
    config: 'interspace', gcr: [0.30, 0.45], height: '1.5–3.0 m', tiltAdj: 0,
    crops: ['pulses', 'medicinal', 'veg', 'fodder'],
    notes: ['ICAR-CAZRI Jodhpur (105 kW, 2017) grew moong, moth, cluster bean, isabgol, cumin, chickpea and aloe between panel rows; reported LER 1.42–1.62.', 'Shade lowers soil evaporation and leaf temperature: the largest co-benefit of any zone.', 'Harvest rain from panels: about 1.5 lakh litres per acre at CAZRI, enough for 40 mm of irrigation.', 'Wind-breaks and dust: plan for frequent module cleaning.'],
    risks: ['Dust storms and soiling', 'Water for module cleaning', 'Wind loads', 'Sandy soils'] },
  BWk: { name: 'Cold desert', color: '#ff9696', group: 'B', beta: 0.40, soil: 0.04,
    india: 'High-altitude rain-shadow valleys (parts of Ladakh, Lahaul-Spiti).',
    climate: 'Dry and cold, with strong sun at altitude.',
    config: 'greenhouse', gcr: [0.20, 0.35], height: 'Greenhouse / 2.5–3.5 m', tiltAdj: 10,
    crops: ['veg', 'leafy', 'fruit'],
    notes: ['Solar-integrated greenhouses extend the short growing season.', 'Steeper tilt sheds snow and catches low winter sun.'],
    risks: ['Snow loads', 'Freezing', 'Remote logistics'] },
  BSh: { name: 'Hot semi-arid (steppe)', color: '#f5a500', group: 'B', beta: 0.45, soil: 0.045,
    india: 'Punjab, Haryana, Delhi, west Uttar Pradesh, eastern Rajasthan, Gujarat (Saurashtra), Marathwada, interior Karnataka and Rayalaseema.',
    climate: '300–800 mm of rain in a short monsoon; hot summers; groundwater-dependent farming.',
    config: 'elevated', gcr: [0.30, 0.40], height: '3.0–4.0 m', tiltAdj: -2,
    crops: ['veg', 'soy', 'pulses', 'leafy', 'medicinal', 'fodder', 'wheat'],
    notes: ['High solar resource and strong shade co-benefit for summer vegetables.', 'Pair with drip irrigation and PM-KUSUM solar pumps to cut groundwater draw.', 'In the wheat–paddy belt use 4.0–4.5 m clearance for tractors and 5 m where combine harvesters must pass (MNRE handbook), and keep GCR ≤0.35. Wheat and paddy are on the handbook\'s Negative List as crops beneath the array.'],
    risks: ['Heatwaves', 'Groundwater depletion', 'Dust', 'Hail (north-west)'] },
  BSk: { name: 'Cold semi-arid', color: '#ffdc64', group: 'B', beta: 0.30, soil: 0.035,
    india: 'Small high, dry areas.', climate: 'Semi-arid with cool winters.',
    config: 'interspace', gcr: [0.30, 0.40], height: '2.0–3.0 m', tiltAdj: 3,
    crops: ['veg', 'pulses', 'fodder'], notes: ['Steeper tilt for winter sun.'], risks: ['Frost', 'Wind'] },
  Csa: { name: 'Mediterranean (hot summer)', color: '#ffff00', group: 'C', beta: 0.30, soil: 0.03,
    india: 'Rare in India.', climate: 'Dry hot summer, wet winter.', config: 'elevated', gcr: [0.30, 0.40], height: '3.0–4.0 m', tiltAdj: 0,
    crops: ['fruit', 'veg', 'leafy'], notes: ['Vineyards and orchards benefit from shade and hail protection.'], risks: ['Summer drought'] },
  Cwa: { name: 'Humid subtropical (dry winter, hot summer)', color: '#96ff96', group: 'C', beta: 0.22, soil: 0.03,
    india: 'Indo-Gangetic plain (east UP, Bihar), north Madhya Pradesh, Jharkhand, Assam, sub-Himalayan foothills.',
    climate: 'Hot, humid monsoon summer and cool, foggy dry winter; 800–1,600 mm of rain.',
    config: 'elevated', gcr: [0.25, 0.35], height: '3.5–5.0 m', tiltAdj: 0,
    crops: ['veg', 'leafy', 'roots', 'spices', 'flowers', 'wheat'],
    notes: ['Winter fog and haze raise the diffuse share: bifacial modules and moderate GCR work well.', 'Rice and wheat are shade-sensitive and on the MNRE handbook\'s Negative List beneath the array: if they stay in rotation, grow them in the inter-row strips, keep GCR ≤0.30 and clearance ≥5 m for combines.', 'Potato, onion, garlic and leafy greens suit rabi-season agrivoltaics.'],
    risks: ['Flooding in Bihar and Assam', 'Winter fog lowers yield', 'Small, fragmented holdings'] },
  Cwb: { name: 'Subtropical highland (dry winter)', color: '#64c864', group: 'C', beta: 0.10, soil: 0.02,
    india: 'Eastern Himalaya and North-East hills (Arunachal, Meghalaya, Sikkim), Nilgiris and other southern hill ranges.',
    climate: 'Mild temperatures, heavy monsoon rain, cool winters.',
    config: 'elevated', gcr: [0.20, 0.30], height: '2.5–4.0 m', tiltAdj: 0,
    crops: ['plantation', 'spices', 'leafy', 'roots', 'flowers'],
    notes: ['Tea, cardamom and coffee are traditionally shade-grown: agrivoltaics can stand in for shade trees.', 'Terraced slopes call for small, site-specific arrays.'],
    risks: ['Steep terrain', 'Landslides', 'Heavy rain', 'Low irradiance in monsoon'] },
  Cwc: { name: 'Cold subtropical highland', color: '#329632', group: 'C', beta: 0.05, soil: 0.02,
    india: 'High Himalayan valleys.', climate: 'Cool with short summers.', config: 'greenhouse', gcr: [0.20, 0.30], height: 'Greenhouse', tiltAdj: 10,
    crops: ['leafy', 'roots'], notes: ['Protected cultivation.'], risks: ['Snow', 'Terrain'] },
  Cfa: { name: 'Humid subtropical (no dry season)', color: '#c8ff50', group: 'C', beta: 0.10, soil: 0.02,
    india: 'Kashmir valley floor (Srinagar, Pulwama, Badgam).',
    climate: 'Warm summers, cold winters, rain and snow spread through the year.',
    config: 'elevated', gcr: [0.25, 0.35], height: '4.0–5.0 m', tiltAdj: 8,
    crops: ['fruit', 'leafy', 'roots'],
    notes: ['Apple and cherry orchards: panels can replace anti-hail nets.', 'Steeper tilt (≈ latitude + 8°) sheds snow and catches winter sun.'],
    risks: ['Snow loads', 'Hail', 'Frost'] },
  Cfb: { name: 'Temperate oceanic', color: '#64ff50', group: 'C', beta: 0.05, soil: 0.02,
    india: 'Mid-altitude Kashmir and Pir Panjal (Anantnag, Baramulla, Kupwara).',
    climate: 'Mild summers, cold snowy winters.',
    config: 'elevated', gcr: [0.20, 0.30], height: '4.0–5.0 m', tiltAdj: 10,
    crops: ['fruit', 'leafy', 'roots'],
    notes: ['Orchard agrivoltaics with hail protection.', 'Design for snow loads.'],
    risks: ['Snow loads', 'Frost', 'Terrain'] },
  Dwa: { name: 'Continental (dry winter, hot summer)', color: '#aaafff', group: 'D', beta: 0.10, soil: 0.02,
    india: 'Rare in India.', climate: 'Cold winters.', config: 'elevated', gcr: [0.25, 0.35], height: '3.5–4.5 m', tiltAdj: 10,
    crops: ['veg', 'roots'], notes: ['Snow-shedding tilt.'], risks: ['Snow', 'Frost'] },
  Dwb: { name: 'Continental (dry winter, warm summer)', color: '#5a78dc', group: 'D', beta: 0.02, soil: 0.02,
    india: 'High eastern Himalaya.', climate: 'Cold dry winters, mild wet summers.', config: 'greenhouse', gcr: [0.20, 0.30], height: 'Greenhouse / 3.5–5.0 m', tiltAdj: 12,
    crops: ['leafy', 'roots'], notes: ['Protected cultivation; steep tilt for snow.'], risks: ['Snow', 'Frost', 'Terrain'] },
  Dwc: { name: 'Subarctic (dry winter)', color: '#4b50b4', group: 'D', beta: 0.0, soil: 0.02,
    india: 'High Himalaya.', climate: 'Long cold winters.', config: 'greenhouse', gcr: [0.15, 0.25], height: 'Greenhouse', tiltAdj: 15,
    crops: ['leafy', 'roots'], notes: ['Protected cultivation only.'], risks: ['Snow', 'Access'] },
  Dfb: { name: 'Humid continental (warm summer)', color: '#37c8ff', group: 'D', beta: 0.02, soil: 0.02,
    india: 'High valleys of Jammu & Kashmir (e.g. Bandipora).',
    climate: 'Cold, snowy winters and short warm summers.',
    config: 'greenhouse', gcr: [0.20, 0.30], height: 'Greenhouse / 3.5–5.0 m', tiltAdj: 12,
    crops: ['fruit', 'leafy', 'roots'],
    notes: ['Solar greenhouses and orchard systems; steep tilt for snow.'],
    risks: ['Heavy snow', 'Frost', 'Short season'] },
  Dfc: { name: 'Subarctic', color: '#007d7d', group: 'D', beta: 0.0, soil: 0.02,
    india: 'High-altitude districts of Jammu & Kashmir (Kishtwar, Ganderbal).',
    climate: 'Long, severe winters and very short summers.',
    config: 'greenhouse', gcr: [0.15, 0.25], height: 'Greenhouse', tiltAdj: 15,
    crops: ['leafy', 'roots'], notes: ['Agrivoltaics is limited to protected cultivation and cold storage.'],
    risks: ['Snow', 'Avalanches', 'Access'] },
  ET:  { name: 'Tundra (alpine)', color: '#b2b2b2', group: 'E', beta: 0.0, soil: 0.02,
    india: 'Ladakh (Leh, Kargil), Lahaul-Spiti, high Uttarakhand and Sikkim.',
    climate: 'Warmest month below 10 °C on average; very high UV and clear skies.',
    config: 'greenhouse', gcr: [0.15, 0.25], height: 'Greenhouse', tiltAdj: 15,
    crops: ['leafy', 'roots', 'fruit'],
    notes: ['Excellent sun but little arable land: solar-heated greenhouses (e.g. Ladakh trench greenhouses) and solar cold storage for apricot and sea-buckthorn.', 'Steep tilt (≈ latitude + 15°) for snow and winter sun.'],
    risks: ['Extreme cold', 'Snow loads', 'Very short season', 'Fragile ecology'] },
  EF:  { name: 'Ice cap', color: '#666666', group: 'E', beta: 0, soil: 0.02, india: 'Glaciers.', climate: 'Permanent ice.', config: 'none', gcr: [0, 0], height: '–', tiltAdj: 0, crops: [], notes: ['Not suitable.'], risks: ['Not suitable'] },
};
export const KOPPEN_GROUP = { A: 'Tropical', B: 'Arid', C: 'Temperate', D: 'Continental', E: 'Polar / alpine' };

// Crop groups. alpha = shade sensitivity: fractional yield loss per unit fractional light reduction
// (0 = indifferent, 1 = proportional, >1 = C4 / light-hungry). margin = indicative gross margin, Rs/ha/yr.
export const CROPS = {
  auto:       { label: 'Best fit for the climate zone (auto)', alpha: null, margin: null, examples: '' },
  spices:     { label: 'Shade-loving spices', alpha: 0.10, margin: 250000, examples: 'turmeric, ginger, cardamom, black pepper' },
  plantation: { label: 'Shade-grown plantation crops', alpha: 0.05, margin: 150000, examples: 'tea, coffee, cocoa' },
  leafy:      { label: 'Leafy vegetables & herbs', alpha: 0.30, margin: 150000, examples: 'spinach, lettuce, fenugreek, coriander, amaranth' },
  medicinal:  { label: 'Medicinal & aromatic plants', alpha: 0.45, margin: 90000, examples: 'aloe vera, isabgol, mint, lemongrass, ashwagandha' },
  fodder:     { label: 'Fodder & grasses', alpha: 0.45, margin: 60000, examples: 'napier, berseem, lucerne' },
  fruit:      { label: 'Fruits & berries', alpha: 0.50, margin: 250000, examples: 'strawberry, papaya, pineapple, dragon fruit, apple (hill zones)' },
  veg:        { label: 'Fruiting vegetables', alpha: 0.55, margin: 200000, examples: 'tomato, chilli, capsicum, brinjal, okra' },
  flowers:    { label: 'Flowers (floriculture)', alpha: 0.40, margin: 300000, examples: 'marigold, tuberose, gerbera, chrysanthemum, rose' },
  roots:      { label: 'Roots, tubers & bulbs', alpha: 0.50, margin: 120000, examples: 'potato, sweet potato, carrot, radish, onion, garlic' },
  soy:        { label: 'Soybean & groundnut', alpha: 0.55, margin: 45000, examples: 'soybean, groundnut' },
  pulses:     { label: 'Pulses & legumes', alpha: 0.70, margin: 45000, examples: 'moong, moth bean, cluster bean, chickpea, cowpea' },
  wheat:      { label: 'Wheat & rabi cereals', alpha: 0.90, margin: 50000, examples: 'wheat, barley, mustard' },
  rice:       { label: 'Paddy', alpha: 1.00, margin: 45000, examples: 'kharif rice' },
  cotton:     { label: 'Cotton & other oilseeds', alpha: 1.00, margin: 50000, examples: 'cotton, mustard, sunflower' },
  sugarcane:  { label: 'Sugarcane', alpha: 1.10, margin: 80000, examples: 'sugarcane (too tall for most designs)' },
  c4:         { label: 'Maize & millets (C4)', alpha: 1.20, margin: 35000, examples: 'maize, sorghum, pearl millet' },
};

// System configurations. kshade: share of GCR that turns into light reduction at crop level.
// landLoss: cropped area lost to posts / row strips. bif: bifacial gain. prem: capex premium over a
// conventional ground-mounted plant. tcool: cell-temperature reduction from better ventilation (°C).
export const CONFIGS = {
  elevated:   { label: 'Overhead / elevated (Category I)', short: 'Overhead', gcr: 0.35, height: 3.5, kshade: 1.00, landLoss: 0.05, bif: 0.05, prem: 0.25, tcool: 3, ftilt: 1.00, collector: 4.6, orient: 'East–west rows, modules facing south', tiltFixed: true },
  interspace: { label: 'Inter-row / interspace, fixed tilt (Category II)', short: 'Inter-row', gcr: 0.30, height: 1.2, kshade: 0.80, landLoss: 0.12, bif: 0.03, prem: 0.08, tcool: 0, ftilt: 1.00, collector: 2.3, orient: 'East–west rows, modules facing south; crops in the gaps', tiltFixed: true },
  tracker:    { label: 'Single-axis tracker, inter-row (Category II)', short: 'Tracker', gcr: 0.30, height: 2.0, kshade: 0.85, landLoss: 0.18, bif: 0.04, prem: 0.18, tcool: 2, ftilt: 1.13, collector: 2.3, orient: 'North–south rows tracking east to west', tiltFixed: false },
  vertical:   { label: 'Vertical bifacial, east–west facing (Category II)', short: 'Vertical', gcr: 0.15, height: 0.8, kshade: 0.70, landLoss: 0.08, bif: 0.00, prem: 0.15, tcool: 4, ftilt: 0.80, collector: 2.3, orient: 'North–south rows, faces to east and west', tiltFixed: false },
  greenhouse: { label: 'PV greenhouse / protected cultivation', short: 'Greenhouse', gcr: 0.25, height: 3.0, kshade: 1.00, landLoss: 0.05, bif: 0.00, prem: 0.60, tcool: -2, ftilt: 1.00, collector: 2.3, orient: 'Roof-integrated, south-facing roof slope', tiltFixed: true },
};

// Scenario presets. adoption = share of each eligible district's cropland converted to agrivoltaics.
export const SCENARIOS = {
  kusum:    { label: 'KUSUM-scale (2030)', desc: 'About 10 GW: the order of PM-KUSUM Component A (10 GW sanctioned).', adoption: 0.01, threshold: 55, config: 'auto', gcr: 0.35, eff: 21.5, capex: 4.0, tariff: 3.3 },
  moderate: { label: 'Moderate rollout (2035)', desc: 'Agrivoltaics becomes a mainstream option on the best 0.1% of cropland.', adoption: 0.1, threshold: 50, config: 'auto', gcr: 0.35, eff: 22.5, capex: 3.7, tariff: 3.4 },
  ambitious:{ label: 'Ambitious (2047)', desc: 'Agrivoltaics carries a large share of the 2047 solar build-out.', adoption: 0.25, threshold: 45, config: 'auto', gcr: 0.35, eff: 23.5, capex: 3.3, tariff: 3.4 },
  potential:{ label: 'Technical potential', desc: 'Close to the TERI (2026) estimate of 1.2–2.1 TW on highly suitable cropland.', adoption: 1.5, threshold: 50, config: 'auto', gcr: 0.40, eff: 22.5, capex: 3.7, tariff: 3.4 },
};
export const ADOPTION_STEPS = [0.005, 0.01, 0.015, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 1.5, 2, 3, 5];

export const GRID_EF = 0.72; // tCO2/MWh, CEA CO2 Baseline Database (weighted average, recent versions 0.71–0.73)
export const REF_GCR = 0.45; // conventional ground-mounted reference plant used for the LER electricity term

// Text behind the (i) buttons.
export const INFO = {
  scenario: ['Scenario', 'A preset that sets every lever at once. KUSUM-scale is about 10 GW nationally; Technical potential lands near TERI\'s 2026 estimate of 1.2–2.1 TW on highly suitable cropland. Change any lever and the scenario becomes "Custom".'],
  config: ['System configuration', 'Overhead (elevated) systems put crops and machinery under the modules: Category I, at least 3 m clear height under the MNRE handbook (2.1 m under DIN SPEC 91434), at most 10% land loss. Inter-row systems put crops in strips between low rows and vertical bifacial east–west rows block little light at midday: both are Category II, at most 15% land loss. Trackers can be steered to give crops more light at critical stages. Greenhouses suit cold and very wet zones. "Auto" picks by Köppen class under international rules, and by the handbook\'s agro-climatic zone table (Table 2.5) under Indian rules.'],
  gcr: ['Ground coverage ratio (GCR)', 'Module area divided by land area. A conventional plant uses about 0.40–0.50. Agrivoltaics usually runs at 0.20–0.40 to leave light for crops. France and Italy cap it at 40%; the MNRE handbook advises 30–40% for field crops, proposes 40% as the upper bound for its system standard, and notes that GCR under 25% generally keeps crop yield above 80% (Dupraz 2023). Higher GCR means more power per hectare and less light below. Capacity density = GCR × module efficiency × 10 MWp/ha.'],
  height: ['Clearance height', 'Free height from finished ground level to the lowest point of any module or member. MNRE handbook: at least 3.0 m, 4.0–4.5 m for standard tractors, 5.0 m where combine harvesters are used, top edge no higher than about 6 m. DIN SPEC 91434 counts 2.1 m as overhead. Under Indian rules the slider starts at 3 m. Each metre above 3 m adds about 4% to the capex in this model.'],
  eff: ['Module efficiency', 'STC efficiency of the module, set by the module technology and adjustable. Mono TOPCon in India in 2025–26 is about 22–23%, polycrystalline about 17–18%. Higher efficiency gives more MWp on the same covered area, so less shade on crops per MWp.'],
  bifacial: ['Bifacial modules', 'Bifacial modules also collect light reflected from the ground. The gain grows with height and ground albedo (+3–7% here). For vertical systems it is already counted in the yield factor.'],
  crop: ['Crop group', 'How sensitive the crop is to shade (alpha). Leafy greens, spices and plantation crops lose little yield under partial shade; maize, millets, paddy and cotton lose the most. "Auto" picks the best group for each district\'s Köppen class. Under Indian rules it skips the MNRE handbook\'s Negative List (wheat, paddy, maize, sugarcane and pulses beneath the array); those crops can still be grown in inter-row strips with more than 50% light, or beneath the array with an MNRE exception backed by ICAR evidence of at least 80% of baseline yield.'],
  adoption: ['Adoption (% of land base)', 'Share of each eligible district\'s agricultural land base converted to agrivoltaics. The land base is set just above: compact farmland 2024 by default. The KPI line under the map shows how many hectares the land base holds for India or the selected state.'],
  land: ['Agricultural land base', 'Which land counts as available for agrivoltaics. Compact farmland 2024 (default) is cropland from the latest UMD GLAD map (2024, 30 m) inside 300 m cells that are at least half cropland, so scattered plots, homestead gardens and field edges are left out: the most realistic base for arrays. All cropland 2024 uses every GLAD cropland pixel. WorldCover 2021 was the earlier base. The suitability score uses the district\'s cropland share on the chosen map.'],
  crop24: ['Cropland 2024 (GLAD)', 'Share of the district mapped as cropland in 2024 by the University of Maryland GLAD annual cropland maps (Landsat, 30 m; Potapov et al. 2022 method). Cropland means land used for annual and perennial herbaceous crops, including fallow land in the cropping cycle; tree crops such as orchards are not included.'],
  compact: ['Compact farmland', 'Share of the district that is cropland lying in 300 m cells that are at least half cropland (GLAD 2024). It filters out small, scattered plots where an agrivoltaic layout is hard, and is the default land base for capacity.'],
  cropchg: ['Cropland change 2019–2024', 'Change in the GLAD cropland share of the district between 2019 and 2024, in percentage points. Negative values mean cropland lost, often to built-up land or plantations; positive values mean cropland gained.'],
  wind: ['Wind speed', 'Mean wind speed at 10 m and 50 m above ground, 2001–2020, from NASA POWER\'s MERRA-2 data. Wind cools modules (higher yield) and sets the structural wind load that elevated systems must carry.'],
  years: ['Year by year, 2001–2020', 'Annual averages for each year from NASA POWER monthly data: GHI from CERES SYN1deg, rainfall, temperature and wind from MERRA-2. The dashed line is the 20-year mean and the red line the linear trend. Model results use the 20-year averages.'],
  threshold: ['Suitability threshold', 'Only districts with a suitability score at or above this value get agrivoltaics in the scenario. Raise it to concentrate deployment in the best districts.'],
  capex: ['Capex of a conventional plant', 'Cost of a conventional ground-mounted plant in ₹ crore per MWp. Agrivoltaic configurations add a premium on top: elevated +25%, interspace +8%, tracker +18%, vertical +15%, greenhouse +60%. Indian studies report agri-PV raising capital cost by 15–25% (Renewable Watch, 2026).'],
  tariff: ['Electricity tariff', 'Tariff paid for the power. PM-KUSUM Component A tariffs have been about ₹3.0–3.45 per kWh.'],
  rate: ['Discount rate', 'Real weighted average cost of capital used to annualise capex (25-year life).'],
  om: ['O&M', 'Operation and maintenance cost per MWp per year, including cleaning.'],
  margin: ['Crop gross margin', 'Gross margin of the crop without panels, in ₹ per hectare per year. Used to value the yield change under the panels. Leave it on auto to use the crop group\'s default.'],
  weights: ['Suitability weights', 'The suitability score (0–100) mixes five normalised factors: solar resource (GHI 4.0 to 5.8 kWh/m²/day), cropland share (0 to 75%, GLAD 2024 by default), shade co-benefit from the Köppen class and heat, water stress (annual rain 1,500 mm down to 200 mm), and grid access (distance to a ≥66 kV substation and line density). Alpine and continental classes, and districts that are mostly forest, are penalised.'],
  rules: ['Rules', 'Which rule set the dashboard checks designs against. International: DIN SPEC 91434 (Germany), the French APER decree, Japan\'s solar-sharing rules and Italy\'s guidelines (2.1 m clearance, 66% yield floor, 40% coverage cap). India: the MNRE Agri-Photovoltaics Policy Handbook (October 2026): 3 m clearance, 80% yield floor, land loss ≤10% overhead and ≤15% inter-row or vertical, the crop Negative List, districts below 4.0 kWh/m²/day excluded, auto configuration by agro-climatic zone and the Chapter 2 site screens applied to the land base. Switching sets these levers; you can still change each one.'],
  screens: ['Handbook land screens', 'Applies the GIS screens of the MNRE handbook (Table 2.1, adapted from TERI 2025) to the land base: slope under 8° and, on sloping land, south, south-east or south-west aspect (Copernicus DEM, 90 m); outside protected areas and a 1 km buffer (OpenStreetMap via Overture Maps); away from land seasonally under water (JRC Global Surface Water 1984–2021). "Plus substation" also keeps only farmland within 5 km of a mapped substation (Section 1.2; straight-line distance, while the handbook asks for line-routing distance). Districts below 4.0 kWh/m²/day are excluded separately under Indian rules.'],
  sub5: ['Farmland within 5 km of a substation', 'Share of the district\'s compact farmland within 5 km (straight line) of any substation mapped in OpenStreetMap, all voltages (Overture Maps, October 2026 release, about 17,000 substations). The handbook asks for ≤5 km achievable line-routing distance. 33/11 kV substations are under-mapped in OpenStreetMap, so this understates access in many districts. Feeder headroom (the 60–75% loading band and the 80% injection rule) needs DISCOM data and is not shown.'],
  slope: ['Farmland on suitable terrain', 'Share of compact farmland on slopes under 8° (the handbook\'s threshold) from the Copernicus DEM GLO-90. The terrain screen also drops land sloping 2° or more that faces away from south, south-east and south-west.'],
  prot: ['Farmland in or near protected areas', 'Share of compact farmland inside a protected area or within 1 km of one (handbook Table 2.1). Protected areas are OpenStreetMap boundary=protected_area and national parks via Overture Maps land_use (October 2026), which is more current than the open WDPA copies reachable from the build. Forest land is not eligible under the handbook; the GLAD cropland base already leaves forest out.'],
  flood: ['Flood-prone farmland', 'Share of compact farmland that floods more than 0.1 m in a 100-year event, river or coastal, in the WRI Aqueduct Floods historical hazard maps (about 1 km; riverine from the 1960–1999 WATCH baseline, coastal without subsidence). This is the handbook\'s flood-hazard exclusion for extreme-event-prone land. At 1 km it marks whole valley floors, so small hill districts whose farmland sits along rivers can show 100%; check embankments and local drainage on site.'],
  rval: ['R-value (handbook GIS screen)', 'Share of the district\'s compact farmland that passes the terrain, protected-area and flood screens, the handbook\'s R-value (suitable area ÷ agricultural area, Table 2.1 step 3). District GHI must also be at least 4.5 kWh/m²/day for the GIS potential estimate (4.0–4.5 stays eligible for projects).'],
  ghicls: ['Handbook GHI class', 'MNRE handbook Table 2.3: at least 4.5 kWh/m²/day counts towards the GIS potential estimate; 4.0–4.5 is not ineligible for projects; below 4.0 should be excluded at screening. Uses the district\'s annual mean GHI from NASA POWER.'],
  water600: ['Handbook water rule', 'MNRE handbook Table 2.4: more than 600 mm of rain a year or shallow groundwater (<5 m); below 600 mm, assured groundwater or irrigation supply is required.'],
  rwh: ['Rainwater from the panels', 'Module area × annual rainfall × runoff coefficient 0.8 (handbook Section 3.5.3: 1 MWp of modules, about 4,650 m², with 800 mm of rain gives about 2,980 m³ a year). Shown per hectare of array; it can be stored for irrigation or module cleaning.'],
  projects: ['Number of projects', 'Scenario capacity divided by the handbook\'s project size: up to 2 MW in the plains and 300–500 kW in hilly terrain (0.4 MW used here for the Himalayan agro-climatic regions).'],
  cuf: ['CUF and performance ratio', 'Capacity utilisation factor = annual energy ÷ (capacity × 8,760 h). Performance ratio here = AC yield ÷ (plane-of-array irradiation), from the model\'s losses. The handbook\'s reporting card benchmarks are CUF ≥17% and PR ≥0.75.'],
  llr: ['Land loss ratio (LLR)', 'Area lost to posts, non-cultivable strips beside rows, equipment yards and tracks, divided by the project area. Limit: 10% for overhead and 15% for inter-row and vertical systems (MNRE handbook Section 3.5.4, same as DIN SPEC 91434). Reported values: overhead 4–8%, vertical 7–15%, interspaced trackers 21–30%. Shading is not land loss.'],
  teri: ['Handbook GIS potential', 'The handbook\'s 7-step method (Table 2.1, from TERI 2025): permissible area = R-value × agricultural area ÷ cropping intensity, times 0.42–0.75 MW/ha. The crop-wise area and cropping-intensity statistics (MoAFW) are not openly reachable, so this uses screened compact farmland in districts with GHI ≥4.5 kWh/m²/day, times a national factor of 0.13 for the six crop categories the method keeps (fruits, citrus, vegetables, plantation, spices, flowers): about 28 Mha of horticulture in gross cropped area, divided by a cropping intensity near 1.5, as a share of about 140 Mha net sown area. Without the soil-productivity screen the total runs several times above TERI’s 1.2–2.1 TW, so read it as an upper bound. District values are indicative; with state crop statistics the split would differ by district.'],
  // metrics
  suit: ['Suitability score', 'A 0–100 screening score from the weighted factors set under Suitability weights. Use it for comparison only; it is not a site assessment.'],
  ghi: ['Global horizontal irradiance (GHI)', 'Average daily solar energy on a flat surface, from NASA POWER (CERES SYN1deg, 2001–2020 average, about 1° resolution) averaged over the district. Most of India gets 4.5–5.8 kWh/m²/day.'],
  yield: ['Specific yield', 'Annual AC energy per kWp installed: GHI × 365 × transposition gain (fixed tilt about 1 + 0.0045 × latitude, trackers +13%, vertical ×0.80) × (1 − temperature loss) × (1 − soiling) × 0.86 system losses × 0.94 lifetime-average degradation × (1 + bifacial gain). Temperature loss is 0.35%/°C above 25 °C cell temperature, estimated from district temperature and wind.'],
  density: ['Capacity density', 'MWp per hectare = GCR × module efficiency × 10. TERI (2026) used 0.42–0.75 MW/ha for India.'],
  ler: ['Land Equivalent Ratio (LER)', 'Relative crop output plus relative electricity output, compared with growing the crop alone and building a conventional solar plant (GCR 0.45) on separate land. LER above 1 means the shared land beats splitting it. Field trials report 1.3–1.7, including 1.42–1.62 at ICAR-CAZRI Jodhpur.'],
  crop_rel: ['Relative crop yield', 'Crop output per hectare compared with an open field: (1 − land loss) × (1 − alpha × shade + beta × shade). Shade = GCR × configuration factor. Beta is the climate co-benefit: in hot, dry zones shade lowers heat and water stress, which can offset or exceed the light loss. The MNRE handbook (2026) asks for at least 80% of the baseline yield of the same crop on the same land; DIN SPEC 91434 asks for 66%, Japan 80% and France 90%.'],
  water: ['Water saving', 'Estimated cut in crop evapotranspiration under the array. Field studies report 14–29% lower evapotranspiration under partial shade (Marrou et al. 2013) and wetter soils under panels in drylands (Barron-Gafford et al. 2019). Modelled as 0.6 × shade × (0.6 + 0.4 × aridity).'],
  lcoe: ['Levelised cost of electricity', '(Capex × capital recovery factor + O&M) ÷ annual generation, in ₹/kWh. Compare it with the tariff to see the viability gap.'],
  koppen: ['Köppen-Geiger climate class', 'Main class by area share in the district, from the Köppen-Geiger 1986–2010 map (Rubel et al. 2017) sampled at about 300 m. Where the monsoon makes both the dry-summer and dry-winter rules apply, the class is set to dry-winter (Peel et al. 2007), as in Beck et al. (2018). A second classification from NASA POWER monthly data is shown for cross-checking.'],
  cropland: ['Cropland 2021 (ESA WorldCover)', 'Share of the district classed as cropland in ESA WorldCover 2021 (10 m, read here at about 300 m). Shown for comparison; the default land base now uses GLAD 2024.'],
  capacity: ['Agrivoltaic capacity', 'Agricultural land base × adoption share × capacity density, only for districts at or above the suitability threshold.'],
  co2: ['CO₂ avoided', 'Generation × grid emission factor of 0.72 tCO₂/MWh (CEA CO₂ Baseline Database).'],
  revenue: ['Revenue per hectare', 'Electricity sales plus crop margin under the panels, compared with the crop margin of an open field.'],
  module: ['Module technology', 'Monocrystalline cells are cut from a single silicon crystal; polycrystalline (multi-Si) cells from cast blocks of many crystals. Mono TOPCon and HJT (n-type) have the highest efficiency, the lowest temperature loss and high bifaciality. Mono PERC is the older p-type mainstream. Polycrystalline is cheaper per watt but about 17–18% efficient, loses more power in heat (−0.40%/°C) and degrades faster, and it needs more covered area for the same MWp. Choosing a technology sets its efficiency, temperature coefficient, degradation, bifaciality and capex. The MNRE handbook asks for ALMM-listed, DCR-compliant bifacial modules, preferably glass-glass, with bifaciality of at least 0.70 for vertical systems and IEC TS 63126 high-temperature qualification.'],
  irr: ['Project IRR', 'Internal rate of return of the 25-year project cash flow per MWp: capex in year 0, then tariff revenue on a yield that falls by the module degradation rate, minus O&M rising 3% a year. Unlevered and pre-tax. Compare with the cost of capital (discount rate lever).'],
  irr_sys: ['IRR including crop change', 'Adds the change in crop gross margin on the land each MWp occupies: negative when panels reduce yield, positive in hot, dry districts where shade helps.'],
  payback: ['Simple payback', 'Years until cumulative cash flow turns positive.'],
  npv: ['Net present value', 'Present value of the 25-year cash flow at the discount rate, in ₹ crore per MWp.'],
  sites: ['Agrivoltaic project sites', 'The 37 agrivoltaic projects documented in "Agrivoltaics in India: Overview of Projects" by the Indo-German Cooperation on Agrivoltaics (GIZ) and the India Agrivoltaics Alliance (2025): 36 operating sites in 16 states plus BAIF\'s upcoming three-campus project, shown as 40 pins (GIPCL\'s Vastan scale model and BAIF\'s three campuses get their own pins). Positions are the GPS points printed in the report; the two Talf Solar plants in Delhi only have map short links there, so their pins are approximate. Capacity is the agrivoltaic part where the report separates it from a larger plant. Pins merge into numbered groups where they would overlap; zoom in or click a group to pick a site. Photos are taken from the report with its credits.'],
  mandis: ['Mandis (agricultural markets)', 'Two official lists, neither with coordinates: the mandis that reported prices to Agmarknet over the last 30 days (daily data.gov.in files added as they are downloaded, starting 9 November 2026) and the SFAC e-NAM Directory of July 2021 (1,000 e-NAM mandis, 870 read from the PDF). Each mandi is placed by matching its town name to OpenStreetMap place names and market-yard points (Overture Maps, October 2026) inside its district, allowing for renamed and split districts. About 1 in 14 sits on a mapped market yard and the rest on the town or village, so a dot can be a few kilometres from the yard. Roughly 15% could not be matched and are not shown. A single day of Agmarknet prices covers only the mandis that reported that day (many in Tamil Nadu), so each new day fills in more mandis. Each mandi shows the prices of the latest day it reported (solid dots for the newest day, faded dots for mandis that only reported earlier), with the change in modal price from its previous report where the same commodity was quoted. Prices are ₹ per quintal. The e-NAM Directory puts India\'s regulated wholesale markets at more than 6,600, so this layer is a partial picture.'],
  cold: ['Cold storages (NHB)', 'Cold storages, controlled-atmosphere stores, ripening chambers and pack houses assisted by the National Horticulture Board, from the point feed behind NHB\'s Integrated Cold Chain Availability Platform (ICAP) map: 4,934 units with name, state and district. Units built without NHB support are not included. Most coordinates are given to 0.01°, about 1 km. Capacity is not part of the map feed; the ICAP report gives it only as state totals.'],
  grid: ['Power grid', 'Transmission lines and substations from OpenStreetMap (via Overture Maps, October 2026 release): 45,000 line segments of 33–765 kV and 17,000 substations. Use the On/Off switches in the map legend to show only the voltages you want. 33 kV lines are sparse because few are mapped in OpenStreetMap (about 600 segments for India), so a missing 33 kV line does not mean there is none. District figures: distance from the district\'s interior point to the nearest ≥66 kV substation, and kilometres of line per 100 km². OpenStreetMap is incomplete in places and many lines lack a voltage tag, so treat this as indicative; use CEA and state transmission maps for planning. The grid score (60% distance, 40% line density) feeds the suitability score with the Grid access weight.'],
  acr: ['Agro-climatic region', 'The 15 agro-climatic regions of the Planning Commission (1989), grouped by soils, rainfall, temperature and water resources, used for agricultural planning in India. Districts are assigned by state and sub-state region.'],
  ai: ['Aridity index', 'Annual rainfall divided by reference evapotranspiration (UNEP). Below 0.2 arid, 0.2–0.5 semi-arid, 0.5–0.65 dry sub-humid, above 0.65 humid. Evapotranspiration uses the Hargreaves radiation formula with district temperature and NASA POWER solar radiation.'],
  lgp: ['Length of growing period', 'Days a year when rain meets at least half of crop water demand (P ≥ 0.5 PET) and the month is warmer than 5 °C, carrying up to 100 mm of stored soil water into drier months. This follows the FAO agro-ecological zones idea used by ICAR-NBSS&LUP.'],
  deficit: ['Water deficit', 'Sum over the year of monthly reference evapotranspiration minus rainfall, where positive: the water irrigation must supply for a full-cover crop.'],
  shadow: ['Shadow analysis', 'Ray tracing of the array cross-section for 12 representative days, with direct sun from the sun path at the district latitude and diffuse light from the sky the ground can see. Crop side: light at crop level as % of an open field, and how even it is across the row. Solar side: the share of direct sun on modules lost to shading by the neighbouring row.'],
  shadow2d: ['2D cross-section', 'A slice across the rows. Yellow ground is in direct sun; dark ground is in panel shadow. Red marks the part of the centre module shaded by the next row. East–west rows are drawn south to north; trackers and vertical rows west to east.'],
  shadow3d: ['3D view', 'Three-dimensional model of the rows, posts and crops, lit by the sun at the selected month and time with real-time shadows (three.js).'],
  shadow_ground: ['Light across the row', 'Daily light at crop height at each point between two rows, as % of an open field. The minimum shows the darkest strip; a flat line means even light for the crop.'],
  shadow_month: ['Monthly results', 'Ground light and module shading loss on the 15th of each month.'],
};

// Module technologies. gamma = power temperature coefficient (%/°C), deg = annual degradation (%/yr),
// bifi = bifaciality (0 = monofacial only), capexAdj = change in plant capex vs. mono PERC.
export const MODULES = {
  topcon: { label: 'Monocrystalline TOPCon (n-type)', short: 'Mono TOPCon', eff: 22.8, gamma: -0.30, deg: 0.40, bifi: 0.80, capexAdj: 0.00, lowLight: 1.00,
    note: 'Mainstream in India from 2024–25. n-type cells: no light-induced degradation, low temperature loss, high bifaciality.' },
  perc:   { label: 'Monocrystalline PERC (p-type)', short: 'Mono PERC', eff: 21.3, gamma: -0.35, deg: 0.55, bifi: 0.70, capexAdj: -0.02, lowLight: 1.00,
    note: 'The workhorse of 2019–2024 plants. Slightly higher temperature loss and degradation than TOPCon.' },
  hjt:    { label: 'Monocrystalline HJT (heterojunction)', short: 'Mono HJT', eff: 23.5, gamma: -0.26, deg: 0.35, bifi: 0.90, capexAdj: 0.05, lowLight: 1.01,
    note: 'Best temperature coefficient and bifaciality, useful in hot zones and on elevated structures; costs more.' },
  poly:   { label: 'Polycrystalline (multi-Si, p-type)', short: 'Polycrystalline', eff: 17.5, gamma: -0.40, deg: 0.70, bifi: 0, capexAdj: -0.04, lowLight: 0.99,
    note: 'Older multi-crystalline technology, now largely phased out of the ALMM list, and monofacial, so it does not meet the MNRE handbook\'s boundary condition of DCR-compliant bifacial modules. Lower efficiency means more covered area per MWp, so more shade on crops for the same capacity.' },
};

// Planning Commission (1989) agro-climatic regions of India
export const ACR = {
  1:  { name: 'Western Himalayan Region', color: '#8da0cb', rain: '165–2,000 mm', soils: 'Hill, brown forest and alluvial soils', crops: 'Apple, temperate fruits, maize, rice, wheat, saffron, off-season vegetables', av: 'Orchard and greenhouse agrivoltaics; hail protection; snow loads at altitude.' },
  2:  { name: 'Eastern Himalayan Region', color: '#66c2a5', rain: '1,800–3,300 mm', soils: 'Red-loamy, laterite and acidic hill soils', crops: 'Rice, tea, ginger, turmeric, large cardamom, pineapple, citrus', av: 'Small elevated systems over shade-tolerant spices and tea; slopes and heavy rain limit scale.' },
  3:  { name: 'Lower Gangetic Plains Region', color: '#a6d854', rain: '1,300–1,800 mm', soils: 'Alluvial, deltaic soils', crops: 'Rice, jute, potato, vegetables, oilseeds, fish', av: 'Elevated systems over vegetables and potato; raised posts above flood level; aquavoltaics on ponds.' },
  4:  { name: 'Middle Gangetic Plains Region', color: '#ffd92f', rain: '1,000–1,400 mm', soils: 'Alluvial, fertile', crops: 'Rice, wheat, maize, pulses, sugarcane, vegetables', av: 'Small holdings: farmer-group (FPO) projects, high clearance for mechanised rice–wheat, flood-safe design.' },
  5:  { name: 'Upper Gangetic Plains Region', color: '#e5c494', rain: '750–1,000 mm', soils: 'Alluvial, sandy-loam to clay-loam', crops: 'Wheat, rice, sugarcane, potato, mustard, vegetables', av: 'Rabi vegetables and potato under elevated arrays; sugarcane is too tall for most designs.' },
  6:  { name: 'Trans-Gangetic Plains Region', color: '#fc8d62', rain: '360–890 mm', soils: 'Alluvial, sandy-loam, some saline/alkaline', crops: 'Wheat, rice, cotton, mustard, fodder, vegetables', av: 'High irrigation intensity and falling groundwater: shade and solar pumps cut water use. Use 5 m clearance where combines pass (MNRE handbook); grow vegetables and fodder beneath the array, wheat and paddy only in the inter-row strips.' },
  7:  { name: 'Eastern Plateau and Hills Region', color: '#b3b3b3', rain: '1,100–1,600 mm', soils: 'Red, yellow and laterite soils, shallow', crops: 'Rainfed rice, millets, pulses, oilseeds, vegetables', av: 'Rainfed uplands: agrivoltaics plus rain-water harvesting enables a second (rabi) crop.' },
  8:  { name: 'Central Plateau and Hills Region', color: '#e78ac3', rain: '500–1,500 mm', soils: 'Black, red and mixed red-black soils', crops: 'Soybean, wheat, chickpea, pulses, oilseeds, sorghum', av: 'Large holdings and good sun; pulses and vegetables under interspace or elevated systems.' },
  9:  { name: 'Western Plateau and Hills Region', color: '#1b9e77', rain: '600–1,000 mm', soils: 'Deep black cotton soils (Vertisols)', crops: 'Cotton, sorghum, soybean, sugarcane, pulses, grapes, pomegranate', av: 'Horticulture (grapes, pomegranate, vegetables) under elevated arrays; strong heat co-benefit.' },
  10: { name: 'Southern Plateau and Hills Region', color: '#d95f02', rain: '500–1,000 mm', soils: 'Red loamy and black soils', crops: 'Millets, groundnut, pulses, cotton, vegetables, mango, sericulture', av: 'Semi-arid, very good sun: dryland horticulture and pulses; PM-KUSUM feeder solarisation hubs.' },
  11: { name: 'East Coast Plains and Hills Region', color: '#7570b3', rain: '780–1,300 mm', soils: 'Alluvial, coastal sands, red soils', crops: 'Rice, groundnut, pulses, coconut, banana, chilli, vegetables', av: 'Cyclone-rated structures; vegetables and chilli; aquavoltaics in deltas.' },
  12: { name: 'West Coast Plains and Ghats Region', color: '#e7298a', rain: '2,000–3,600 mm', soils: 'Laterite, coastal alluvial', crops: 'Rice, coconut, arecanut, spices (pepper, cardamom), cashew, rubber', av: 'Very wet: low GCR over shade-loving spices; drainage and corrosion design.' },
  13: { name: 'Gujarat Plains and Hills Region', color: '#66a61e', rain: '340–1,800 mm', soils: 'Black, alluvial and coastal saline soils', crops: 'Cotton, groundnut, castor, cumin, wheat, vegetables', av: 'High sun and strong solar policy; cumin, vegetables and groundnut under elevated systems.' },
  14: { name: 'Western Dry Region', color: '#e6ab02', rain: '100–500 mm', soils: 'Desert sandy soils', crops: 'Pearl millet, cluster bean, moth bean, moong, cumin, isabgol', av: 'Best solar resource and largest shade co-benefit (CAZRI Jodhpur); dust and water for cleaning.' },
  15: { name: 'Islands Region', color: '#a6761d', rain: '1,500–3,000 mm', soils: 'Coastal sandy and laterite soils', crops: 'Coconut, arecanut, spices, rice', av: 'Diesel displacement on islands; corrosion and cyclone design.' },
};

// ---------------------------------------------------------------- rule sets
// International = DIN SPEC 91434 / France / Japan / Italy; India = MNRE Agri-Photovoltaics Policy Handbook (Oct 2026).
export const RULES = {
  intl: { label: 'International', long: 'International (DIN SPEC 91434, France, Japan, Italy)', minClear: 2.1, combineClear: 3.5,
    yieldFloor: 0.66, yieldName: 'DIN SPEC 91434', gcrMax: 0.40, llr: { elevated: 0.10, other: 0.15 }, negative: [], ghiExclude: null, screens: 'none', autoConfig: 'koppen' },
  india: { label: 'India (MNRE 2026)', long: 'India: MNRE Agri-Photovoltaics Policy Handbook (October 2026)', minClear: 3.0, combineClear: 5.0,
    yieldFloor: 0.80, yieldName: 'MNRE handbook', gcrMax: 0.40, llr: { elevated: 0.10, other: 0.15 }, negative: ['wheat', 'rice', 'c4', 'pulses', 'sugarcane'], ghiExclude: 4.0, screens: 'gis', autoConfig: 'acz' },
};
// MNRE handbook Section 1.2 crop lists, mapped to the dashboard's crop groups
export const POSITIVE = ['leafy', 'veg', 'soy', 'cotton', 'fodder', 'spices', 'flowers', 'fruit', 'plantation', 'medicinal', 'roots'];
export const NEGATIVE = ['wheat', 'rice', 'c4', 'pulses', 'sugarcane'];
export const SCREENS = {
  none: 'No land screens',
  gis: 'Terrain, protected areas, flood (Table 2.1)',
  gis5: 'Same, plus within 5 km of a substation',
};
// Handbook Table 2.5: typology by agro-climatic zone, keyed to the Planning Commission regions
export function aczConfig(acr, rain) {
  if (rain > 2000 || acr === 12 || acr === 15) return 'greenhouse';           // Western Ghats and coast: structure-integrated
  if (acr === 13 || acr === 14) return 'vertical';                             // semi-arid Rajasthan and Gujarat: vertical E-W
  if (acr === 6 && rain < 600) return 'vertical';
  if ([7, 8, 9, 10].includes(acr) && rain <= 800) return 'interspace';         // rainfed peninsular plateau: interspace fixed
  if (acr === 1 || acr === 2) return null;                                     // Himalaya: not in the table, keep the Köppen choice
  return 'elevated';                                                           // Indo-Gangetic plains and the rest: overhead fixed
}
export const HANDBOOK = { ghiGis: 4.5, ghiMin: 4.0, rainMin: 600, sub: 5, pdMin: 0.42, pdMax: 0.75, cuf: 0.17, pr: 0.75, hort: 0.13, mwPlain: 2, mwHill: 0.4, runoff: 0.8 };
