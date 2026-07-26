// Pet capture points. Neither roworlddb.com's own map tool nor the
// benzlovely12 community tracker track this — pets are tamed from ordinary
// wild monsters roaming a general area, not fixed pins the way cards/chests
// are, so there's no dataset of exact points to begin with.
//
// Positions were hand-transcribed from screenshots of a third-party
// player-made map tool (branded "KK PLUS") the user shared. Each screenshot
// only exposed ONE confirmed world coordinate (for a nearby dungeon
// entrance/teleport marker, not the pets themselves) with no second
// reference point to derive the map's pixel-to-world scale at that zoom
// level — so these are the named region's coordinate space with each pet
// placed near that anchor and spread out in roughly the right relative
// direction, NOT pixel-precise positions. Treat as "look around here",
// not an exact pin.
//
// No species/icon is asserted here — a prior attempt to visually match
// each screenshot's creature against roworlddb's own pet library turned
// out wrong (confirmed by the user), so rendering just uses a generic paw
// marker (see mapData.ts) until species are confirmed for real.
export interface PetCapturePoint { sceneId: number; x: number; z: number; }

export const PET_CAPTURE_POINTS: PetCapturePoint[] = [
  // Morroc - Sograt Desert
  { sceneId: 102, x: 560, z: 390 },
  { sceneId: 102, x: 480, z: 440 },
  // Geffen - Kordt Forest
  { sceneId: 107, x: 250, z: 60 },
  { sceneId: 107, x: 120, z: -30 },
  // Geffen - Geffen Wilds
  { sceneId: 107, x: 150, z: 420 },
  { sceneId: 107, x: 250, z: 300 },
  { sceneId: 107, x: 180, z: 150 },
  { sceneId: 107, x: 350, z: 80 },
  // Geffen Underground floor 1
  { sceneId: 10713, x: 60, z: 470 },
  { sceneId: 10713, x: 140, z: 420 },
  // Geffen Underground floor 2
  { sceneId: 10714, x: 110, z: 60 },
  { sceneId: 10714, x: 170, z: 180 },
  { sceneId: 10714, x: 60, z: 190 },
  // Poring Island - Sograt Oasis
  { sceneId: 10242, x: 600, z: 420 },
  { sceneId: 10242, x: 650, z: 460 },
  // Payon - Munak Cave 3F
  { sceneId: 10313, x: 600, z: 180 },
  { sceneId: 10313, x: 700, z: 120 },
  { sceneId: 10313, x: 660, z: 260 },
  // Byalan Island - Undersea Cave floor 2
  { sceneId: 10412, x: 150, z: 500 },
  { sceneId: 10412, x: 280, z: 470 },
];
