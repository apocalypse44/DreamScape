// Tuning for the dog's moods, the lore NPCs and the ember shards.

// NPC body and clips (relative to index.html). UAL1 and UAL2 share the mannequin's skeleton.
export const NPC_ASSETS = {
  mannequin:
    'assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb',
  ual1: 'assets/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
  ual2:
    'assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb',
};

// Score thresholds (same as the rest of the game).
export const CHAOS_ENTER = 0.65;
export const CHAOS_CALM = 0.4;

// Lore wanderers placed around the Crossing, one per theme.
export const HINTS = {
  hub: 'Three embers, one shrine. The keeper knows the way.',
  north: 'The hound hides where the land splits open. Walk softly near it.',
  east: 'One ember waits at the top of the floating stones. Jump carefully.',
  south: 'Sprint and leap. Some gaps only the brave can clear.',
  west: 'The mist listens. Stay calm and it will part for you.',
};
export const NPC_TINTS = {
  keeper: 0xe8d7b0,
  hub: 0xc6ff65,
  north: 0x8fe36b,
  east: 0xff6b6b,
  south: 0xffd36b,
  west: 0xb9a6ff,
};

// Animation name patterns. The first pattern that matches a clip name wins.
export const NPC_CLIPS = {
  idle: [/^idle_loop$/i, /^idle/i, /idle/i],
  walk: [/^walk_loop$/i, /^walk/i, /walk/i],
  talk: [/talk/i, /convers/i, /interact/i, /wave/i, /gesture/i],
  scared: [/cower/i, /fear/i, /scared/i, /crouch.*idle/i, /hit/i],
  flee: [/sprint/i, /jog/i, /run/i],
};

// Distances (metres) and timings (seconds).
export const PET_DISTANCE = 2.2;
export const PET_TIME = 2.2;
export const PET_CHAOS_DROP = -0.1;
export const BARK_DISTANCE = 7;
export const BARK_COOLDOWN = 6;
export const SIT_DISTANCE = 5;
export const FETCH_EVERY = 20;
export const FETCH_CHAOS_DROP = -0.05;
export const TALK_DISTANCE = 4;
export const SCARE_DISTANCE = 8;
export const NPC_ACTIVE_RADIUS = 80;
export const WANDER_RADIUS = 15;
export const NPC_HEIGHT = 1.75;
export const EMBER_LIGHT_RANGE = 30;
