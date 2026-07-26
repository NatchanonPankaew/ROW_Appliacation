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
// petIcon is a best-effort visual match against roworlddb's own 29-pet
// library (pet/data/pet_library_*.json) — compared the general creature
// shape/theme in each screenshot (elephant, wolf, gryphon, ghost, etc.)
// against the official portrait art, not a confirmed 1:1 species id, since
// the KK PLUS screenshots render icons in a different art style than
// roworlddb's own. Reasonably confident, not certain.
export interface PetCapturePoint { sceneId: number; x: number; z: number; petIcon: string; }

export const PET_CAPTURE_POINTS: PetCapturePoint[] = [
  // Morroc - Sograt Desert - Rock Mammoth
  { sceneId: 102, x: 560, z: 390, petIcon: "icon_pet_head_ysmm_1" },
  { sceneId: 102, x: 480, z: 440, petIcon: "icon_pet_head_ysmm_1" },
  // Geffen - Kordt Forest - Forest Wolf
  { sceneId: 107, x: 250, z: 60, petIcon: "icon_pet_head_smzl_1" },
  { sceneId: 107, x: 120, z: -30, petIcon: "icon_pet_head_smzl_1" },
  // Geffen - Geffen Wilds - Gryphon
  { sceneId: 107, x: 150, z: 420, petIcon: "icon_pet_head_sj_1" },
  { sceneId: 107, x: 250, z: 300, petIcon: "icon_pet_head_sj_1" },
  { sceneId: 107, x: 180, z: 150, petIcon: "icon_pet_head_sj_1" },
  { sceneId: 107, x: 350, z: 80, petIcon: "icon_pet_head_sj_1" },
  // Geffen Underground floor 1 - Lunatic
  { sceneId: 10713, x: 60, z: 470, petIcon: "icon_pet_head_ft_1" },
  { sceneId: 10713, x: 140, z: 420, petIcon: "icon_pet_head_ft_1" },
  // Geffen Underground floor 2 - Garm Baby
  { sceneId: 10714, x: 110, z: 60, petIcon: "icon_pet_head_klbb_1" },
  { sceneId: 10714, x: 170, z: 180, petIcon: "icon_pet_head_klbb_1" },
  { sceneId: 10714, x: 60, z: 190, petIcon: "icon_pet_head_klbb_1" },
  // Poring Island - Sograt Oasis - Alice
  { sceneId: 10242, x: 600, z: 420, petIcon: "icon_pet_head_alsnp_1" },
  { sceneId: 10242, x: 650, z: 460, petIcon: "icon_pet_head_alsnp_1" },
  // Payon - Munak Cave 3F - Whisper
  { sceneId: 10313, x: 600, z: 180, petIcon: "icon_pet_head_byl_1" },
  { sceneId: 10313, x: 700, z: 120, petIcon: "icon_pet_head_byl_1" },
  { sceneId: 10313, x: 660, z: 260, petIcon: "icon_pet_head_byl_1" },
  // Byalan Island - Undersea Cave floor 2 - Squidgitte
  { sceneId: 10412, x: 150, z: 500, petIcon: "icon_pet_head_sdl_1" },
  { sceneId: 10412, x: 280, z: 470, petIcon: "icon_pet_head_sdl_1" },
];
