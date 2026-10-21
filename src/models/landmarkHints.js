import { SPADE_MAP_LOCATIONS } from './spadeStory.js';
import { SUMMIT_DOOR, SKY } from './skyIsland.js';

const localLandmarks = {
  'SPADE KINGDOM': SPADE_MAP_LOCATIONS.map(p => ({
    ...p.destination,
    name: p.id === 'spade-castle' ? 'CASTLE ENTRANCE' : p.name,
    note: p.id === 'spade-castle' ? 'HOLLOW GATE INSIDE · TRIAD FLOOR 2' : p.note,
  })),
  'CLOVER KINGDOM': [
    { name: 'CLOVER SUMMIT', ...SUMMIT_DOOR, note: 'SKY GATEWAY' },
    { name: 'SKY GARDEN', ...SKY, note: 'VIA SUMMIT GATEWAY' },
  ],
};

export function landmarkHintLines(kingdom, player) {
  return (localLandmarks[kingdom] || []).map(p =>
    `${p.name} · ${Math.round(Math.hypot(player.x - p.x, player.z - p.z))} m · ${p.note.toUpperCase()}`);
}
