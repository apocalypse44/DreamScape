// Tidewell, Heart's walled town of stopped mills (HEART_KINGDOM_DESIGN.md §9). Pure layout and ground shaping.
// A canal runs from the west gate to the Listening Spring at the crater's edge. Rows of red homes fill the
// districts either side; a market plaza, the tavern, church and two watermills stand on the canal; a garden
// avenue leads south to the palace and its barracks; walls and towers close the city in, open only to the
// reef in the east; farmland and windmills lie outside the north gate. Everything stands dry until the Tide
// Sigil returns the current (the renderer brings it to life).
// Positions are (along, side) metres from the Heart gate, like heartLayout.

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

export const TOWN_Y = 1.5;     // the town's flat ground (the plains' height)
const EDGE = 12;               // metres over which the flat ground blends back into Heart's land
// The walled city (inner faces of the walls).
export const CITY = { a0: 4, a1: 92, s0: -118, s1: 62 };
// Flattened rectangles. Full flatness starts EDGE inside each.
const FLAT = [
  { a0: CITY.a0 - EDGE, a1: CITY.a1 + EDGE, s0: CITY.s0 - EDGE, s1: CITY.s1 + EDGE }, // the city and its walls
  { a0: -4, a1: 104, s0: 50, s1: 142 },                                               // farmland outside the north gate
];
export const CANAL = { from: 8, to: 68, half: 2.6, bank: 1.5, depth: 2.2 };
export const SPRING = { along: 72, side: 0, radius: 4.2, depth: 1 }; // the Listening Spring's basin
export const PALACE = { along: 50, side: -80, plinth: 15, rise: 2.4, height: 26 };
// The throne hall on the plinth, walked into through its door facing town (+side). [along a0..a1, side s0..s1]
export const HALL = { a0: 40, a1: 60, s0: -92, s1: -70, height: 9, wall: 0.8, door: 4.4, doorHeight: 5.5 };
export const WALL = { height: 7, thickness: 2.4 };

// Streets and plazas: paved, and kept clear of homes. [a0, a1, s0, s1]
export const STREETS = [
  [6, 70, 4.6, 10], [6, 70, -10, -4.6],          // the canal streets
  [-6, 6, -6, 6],                                // the west gate road
  [64, 90, 8, 18], [64, 90, -18, -8], [78, 92, -8, 8], // the Listening Spring's plaza (the basin stays open)
  [18, 40, -36, -12],                            // the market plaza
  [44, 56, -57, -10],                            // the garden avenue
  [12, 16, 10, 62], [12, 16, -118, -10],         // cross streets
  [76, 80, 10, 62], [76, 80, -118, -10],
  [44, 52, 10, 62],                              // the north gate street
];
// Other ground kept clear of homes (beyond the streets): the palace grounds and the reef terrace.
const CLEAR = [[30, 70, -100, -57], [82, 92, -24, 24]];

// Landmark buildings: [model, along, side, height (m), collider radius]. Fronts face the nearest street.
const LANDMARKS = [
  ['tavern', 28, 16, 9, 4.2], ['church', 66, 36, 14, 5.5], ['blacksmith', 62, -17, 8, 4],
  ['lumbermill', 22, 48, 8, 4.5], ['market', 29, -27, 6, 5.2],
  ['barracks', 38, -108, 9, 5], ['barracks', 62, -108, 9, 5],
];
export const WELL = { along: 35, side: -16, height: 3, radius: 1.3 };
export const MILLS = [{ along: 44, side: 1 }, { along: 22, side: -1 }]; // side: which bank (the wheel dips into the canal)
export const BRIDGES = [33, 56];          // along; each spans the canal
export const BOATS = [[40, 0.4, 0.3], [63, -0.5, -0.2]]; // [along, side, yaw offset]
export const GARDEN_FOUNTAINS = [[50, -24], [50, -40]];
export const MIRROR_POOLS = [[40, -52], [60, -52]]; // [along, side]: long pools either side of the avenue's end
export const STALLS = [[22, -16], [25, -16], [22, -21], [37, -22], [37, -27], [33, -32], [24, -32]];
export const FLOWERS = [[14, 6], [26, 6.5], [38, 6], [50, 6.5], [62, 6], [18, -6.5], [30, -6], [48, -6], [64, -6.5],
  [46, -34], [54, -34], [46, -46], [54, -46], [38, -60], [62, -60], [70, 6], [70, -6]];
// Walls: [a0, s0, a1, s1] runs. Gates: west (the road), north (the farms); the east side opens onto the reef.
export const WALLS = [
  [4, -118, 4, -9], [4, 9, 4, 62],
  [4, 62, 44, 62], [52, 62, 92, 62],
  [4, -118, 92, -118],
  [92, -118, 92, -22], [92, 22, 92, 62],
];
export const TOWERS = [[4, -118], [4, 62], [92, -118], [92, 62], [4, -11], [4, 11], [42, 62], [54, 62],
  [92, -24], [92, 24], [4, -64], [48, -118], [92, -70], [24, 62], [72, 62]];
export const WINDMILLS = [[20, 100], [50, 114], [82, 100]];
// Townsfolk you can talk to (lines change once the current is back), and those who return with it.
export const FOLK = [
  { name: 'Miller Tobin', along: 47, side: 8.5,
    dry: 'TOBIN · The wheel has not turned since the current was taken. A mill without water is just a heavy house.',
    restored: 'TOBIN · Listen to her go! First flour in a season. Come back for bread, traveller.' },
  { name: 'Rosa', along: 31, side: -13,
    dry: 'ROSA · I sell flowers, when there are any. Nothing blooms in Tidewell while the springs are dry.',
    restored: 'ROSA · Look at the banks! I will have the whole canal in bloom by morning.' },
  { name: 'Bridgekeeper Kett', along: 56, side: -5.5,
    dry: 'KETT · Forty years I kept this bridge over water. Now I keep it over mud. Sera says the reef holds the answer.',
    restored: 'KETT · Water under my bridge again. The boats are already lifting. Bless you.' },
  // Inside the throne hall, before the dais (floor: stands on the plinth, not the ground).
  { name: 'Steward Maren', along: 50, side: -83.5, floor: true,
    dry: 'MAREN · When the springs failed, Queen Elowen walked out to the reef alone, and the ground took her. I keep her hall lit. Help Sera, and help us.',
    restored: 'MAREN · The fountains sing in the palace again. When the queen returns, she will hear who brought the current home.' },
];
export const RETURNING = [{ name: 'Fisher Ilo', along: 38, side: 5.4 }, { name: 'Lamplighter Wen', along: 22, side: 5 }];

const inRect = (along, side, [a0, a1, s0, s1], pad = 0) => along > a0 - pad && along < a1 + pad && side > s0 - pad && side < s1 + pad;

// Rows of homes fill every district: candidates on a grid, kept off streets, plazas, landmarks and each other.
function homes() {
  const placed = [];
  const solid = [
    ...LANDMARKS.map(([, along, side, , radius]) => ({ along, side, radius })),
    ...MILLS.map(m => ({ along: m.along, side: m.side * 6.5, radius: 4 })),
    { along: WELL.along, side: WELL.side, radius: WELL.radius },
    ...MIRROR_POOLS.map(([along, side]) => ({ along, side, radius: 4.5 })),
    ...STALLS.map(([along, side]) => ({ along, side, radius: 1.5 })),
    ...[...FOLK, ...RETURNING].map(f => ({ along: f.along, side: f.side, radius: 1 })),
  ];
  const free = (along, side, radius) =>
    along - radius > CITY.a0 + WALL.thickness + 2 && along + radius < CITY.a1 - 2 &&
    side - radius > CITY.s0 + WALL.thickness + 2 && side + radius < CITY.s1 - WALL.thickness - 2 &&
    !STREETS.some(r => inRect(along, side, r, radius)) && !CLEAR.some(r => inRect(along, side, r, radius)) &&
    !(Math.abs(side) < CANAL.half + CANAL.bank + radius && along < CANAL.to + 6) &&
    ![...solid, ...placed].some(o => Math.hypot(o.along - along, o.side - side) < o.radius + radius + 1.2);
  for (let row = 0; row < 16; row++) {
    const side = row < 5 ? 15 + row * 11 : -(15 + (row - 5) * 9.5); // five rows north, eleven south
    for (let k = 0; k < 11; k++) {
      const along = 12 + k * 8 + (row % 2) * 4;
      const radius = 3.4, h = hash(row, k);
      if (!free(along, side, radius)) continue;
      placed.push({ model: h < 0.5 ? 'home_A' : 'home_B', along, side, height: 6.5 + hash(k, row) * 1.8, radius });
    }
  }
  return placed;
}

export function heartTown(at, local) {
  const place = ([along, side]) => at(along, side);
  // Lower the canal and the spring basin into the flat town ground.
  function carve(along, side) {
    let depth = 0;
    if (along > CANAL.from - 2 && along < CANAL.to + 6) {
      const across = smooth((CANAL.half + CANAL.bank - Math.abs(side)) / CANAL.bank);
      const ends = smooth((along - CANAL.from + 2) / 2) * smooth((CANAL.to + 6 - along) / 4);
      depth = CANAL.depth * across * ends;
    }
    const r = Math.hypot(along - SPRING.along, side - SPRING.side);
    return Math.max(depth, SPRING.depth * smooth((SPRING.radius + 1 - r) / 1.5));
  }
  function weight(along, side) {
    let w = 0;
    for (const f of FLAT) w = Math.max(w, smooth(Math.min(along - f.a0, f.a1 - along, side - f.s0, f.s1 - side) / EDGE));
    return w;
  }
  const buildings = [
    ...LANDMARKS.map(([model, along, side, height, radius]) => ({ model, along, side, height, radius })),
    ...homes(),
  ].map(b => ({ ...b, ...at(b.along, b.side) }));
  // Farmland: grain fields on a grid outside the north wall, clear of the windmills and the north road.
  const fields = [];
  for (let along = 12; along <= 88; along += 12) for (let side = 74; side <= 126; side += 13) {
    if (Math.abs(along - 48) < 7 || WINDMILLS.some(([a, s]) => Math.hypot(a - along, s - side) < 11)) continue;
    fields.push(at(along, side));
  }
  return {
    // The ground with the town in it: Heart's land (h) blends to the flat town, canal and basin carved in.
    ground(x, z, h) {
      const { along, side } = local({ x, z });
      const w = weight(along, side);
      return w <= 0 ? h : h + (TOWN_Y - carve(along, side) - h) * w;
    },
    weight: (x, z) => { const { along, side } = local({ x, z }); return weight(along, side); },
    canalBottom: TOWN_Y - CANAL.depth,
    spring: { ...at(SPRING.along, SPRING.side), radius: SPRING.radius },
    buildings,
    well: { ...at(WELL.along, WELL.side), ...WELL },
    mills: MILLS.map(m => ({ ...m, ...at(m.along, m.side * 4) })), // the wheel's rim reaches into the canal
    bridges: BRIDGES.map(along => ({ along, ...at(along, 0) })),
    boats: BOATS.map(([along, side, yaw]) => ({ ...at(along, side), yaw })),
    // Lanterns line the canal streets, the avenue and the cross streets (none where a mill stands).
    lanterns: [
      ...[12, 20, 28, 36, 44, 52, 60].flatMap(along => [[along, 4.2], [along, -4.2]])
        .filter(([along, side]) => !MILLS.some(m => Math.sign(side) === m.side && Math.abs(along - m.along) < 5)),
      ...[-16, -28, -44].flatMap(side => [[43.5, side], [56.5, side]]),
      ...[20, 32, 44, 56].flatMap(side => [[11.5, side], [80.5, side]]),
      ...[-24, -44, -64, -84, -104].flatMap(side => [[11.5, side], [80.5, side]]),
    ].map(place),
    gardenFountains: GARDEN_FOUNTAINS.map(place),
    mirrorPools: MIRROR_POOLS.map(place),
    stalls: STALLS.map(place),
    flowers: FLOWERS.map(place),
    streets: STREETS.map(([a0, a1, s0, s1]) => ({ a0, a1, s0, s1 })),
    walls: WALLS.map(([a0, s0, a1, s1]) => ({ a0, s0, a1, s1 })),
    towers: TOWERS.map(place),
    windmills: WINDMILLS.map(place),
    fields,
    palace: { ...at(PALACE.along, PALACE.side), ...PALACE, stair: at(PALACE.along, PALACE.side + PALACE.plinth + 4) },
    folk: FOLK.map(f => ({ ...f, ...at(f.along, f.side), ...(f.floor ? { y: TOWN_Y + PALACE.rise } : {}) })),
    hall: HALL,
    returning: RETURNING.map(f => ({ ...f, ...at(f.along, f.side) })),
  };
}
