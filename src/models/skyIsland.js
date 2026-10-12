// All heights are feet heights. The island is separate from generated terrain.
export const SKY = Object.freeze({ x: 88, z: -552, top: 64 }); // x keeps Heavenly Falls clear of the Clover cliffs
export const SUMMIT_DOOR = Object.freeze({ x: 2, z: -499, top: 24 });
export const SKY_DOOR = Object.freeze({ x: SKY.x, z: SKY.z + 14, top: SKY.top });
export const SKY_ARRIVAL = Object.freeze({ x: SKY.x, z: SKY.z + 10, top: SKY.top, yaw: 0 });
export const SUMMIT_ARRIVAL = Object.freeze({ x: 2, z: -503, top: 24, yaw: 0 });
export function islandSurface(x, z, top, outline, bottom) {
  return { x, z, top, bottom, solid: true, outline, contains(px, pz, pad = 0) {
    px -= x; pz -= z;
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[j], b = outline[i], dx = b[0] - a[0], dz = b[1] - a[1];
      if ((a[1] > pz) !== (b[1] > pz) && px < dx * (pz - a[1]) / dz + a[0]) inside = !inside;
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
      if (pad > 0 && Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz) < pad) return true;
    }
    return inside;
  } };
}
const outline = [[-18,-22],[8,-24],[20,-14],[24,2],[16,19],[-5,22],[-21,14],[-24,-4]];
const octagon = r => Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r]);
export const SKY_MAIN = islandSurface(SKY.x, SKY.z, 64, outline, 40);
export const SKY_JUMPS = [[27,-9,65],[32,-12,66],[36,-17,67]].map(([x,z,top]) =>
  islandSurface(SKY.x + x, SKY.z + z, top, octagon(2.5), top - 7));
export const SKY_SECRET = islandSurface(SKY.x + 37, SKY.z - 24, 68, octagon(5.5), 55);
export const SKY_LOOKOUT = islandSurface(SKY.x + 29, SKY.z + 6, 64, octagon(5.5), 51);
export const SKY_RAMP = { x: SKY.x - 5, z: SKY.z, width: 5, depth: 10,
  top: 68, bottom: 63.8, solid: true, ramp: true,
  topAt: (x, z) => 64 + 4 * Math.max(0, Math.min(1, (SKY.z + 5 - z) / 10)) };
export const SKY_SHRINE = { x: SKY.x - 5, z: SKY.z - 11, width: 12, depth: 12, top: 68, bottom: 64, solid: true };
export const SKY_BRIDGE = { x: SKY.x + 22, z: SKY.z + 6, width: 12, depth: 3, top: 64, bottom: 63.6, solid: true };
export const SKY_PLATFORMS = [SKY_MAIN, SKY_LOOKOUT, SKY_SECRET, ...SKY_JUMPS, SKY_RAMP, SKY_SHRINE, SKY_BRIDGE];
export const SKY_WALK_ROUTE = [[0,10],[-5,5],[-5,-7.5],[-5,5],[10,6],[29,6],[0,10]].map(([x,z]) => [SKY.x+x, SKY.z+z]);
export const SKY_TRAVEL_SECONDS = 3.8;
export function skyFlightPose(from, to, elapsed) {
  const progress = Math.max(0, Math.min(1, (elapsed - .6) / 2.6));
  const t = progress * progress * (3 - 2 * progress);
  const bend = progress <= 0 || progress >= 1 ? 0 : Math.sin(Math.PI * t);
  const dx = to.x-from.x, dz = to.z-from.z, length = Math.hypot(dx,dz)||1;
  return { x: from.x+dx*t-dz/length*bend*8, z: from.z+dz*t+dx/length*bend*8,
    top: from.top+(to.top-from.top)*t+bend*22, progress,
    phase: elapsed<.6 ? 'charge' : elapsed<3.2 ? 'flight' : 'arrival',
    charge: Math.min(1, elapsed/.6), arrival: Math.max(0, Math.min(1,(elapsed-3.2)/.6)) };
}

export function createSkyJourney() {
  let visiting = false, pressed = false, transition = null, awakened = false, secret = false;
  let cinematic = null;
  const near = (p, door) => Math.hypot(p.x - door.x, p.z - door.z) < 4.5 && Math.abs(p.y - 2.05 - door.top) < 2;
  return {
    get visiting() { return visiting; },
    get blocked() { return transition !== null; },
    get cinematic() { return cinematic; },
    get awakened() { return awakened; },
    get secret() { return secret; },
    // True where E belongs to the gateway (other E actions such as petting should yield).
    atDoor(position) { return transition !== null || near(position, visiting ? SKY_DOOR : SUMMIT_DOOR); },
    update(dt, position, interact, locked) {
      const rising = interact && !pressed; pressed = interact;
      const door = visiting ? SKY_DOOR : SUMMIT_DOOR;
      let target = null;
      if (!transition && locked && rising && near(position, door)) transition = { time: 0,
        from: {x:position.x,z:position.z,top:position.y-2.05}, to: visiting ? SUMMIT_ARRIVAL : SKY_ARRIVAL };
      let fade = 0;
      cinematic = null;
      if (transition) {
        transition.time += dt;
        cinematic = skyFlightPose(transition.from, transition.to, transition.time);
        const ahead=skyFlightPose(transition.from,transition.to,transition.time+.03);
        const dx = cinematic.phase==='charge' ? transition.to.x-transition.from.x : ahead.x-cinematic.x;
        const dz = cinematic.phase==='charge' ? transition.to.z-transition.from.z : ahead.z-cinematic.z;
        cinematic.yaw = cinematic.progress<.98 ? Math.atan2(-dx,-dz) : transition.to.yaw;
        fade = cinematic.phase==='arrival' ? Math.sin(cinematic.arrival*Math.PI)*.35 : 0;
        if (transition.time >= SKY_TRAVEL_SECONDS) {
          visiting = !visiting; target = transition.to;
          transition = cinematic = null; fade = 0;
        }
      }
      if (visiting && Math.hypot(position.x - SKY_SHRINE.x, position.z - SKY_SHRINE.z) < 4 && Math.abs(position.y - 70.05) < 2) awakened = true;
      if (visiting && SKY_SECRET.contains(position.x, position.z) && Math.abs(position.y - 70.05) < 2) secret = true;
      const hint = near(position, visiting ? SKY_DOOR : SUMMIT_DOOR)
        ? visiting ? 'E · RETURN TO CLOVER SUMMIT' : 'E · ENTER THE FLOATING SKY GARDEN'
        : visiting ? secret && SKY_SECRET.contains(position.x, position.z) ? 'STARLIGHT PERCH · HIDDEN ISLAND DISCOVERED'
          : awakened ? 'SKY GARDEN AWAKENED · EXPLORE THE LOOKOUT AND FLOATING LEDGES' : 'SKY GARDEN · FOLLOW THE STONES TO THE ANCIENT CRYSTAL' : null;
      return { target, flight: cinematic, fade: Math.max(0, fade), hint: cinematic ?
        cinematic.phase==='charge' ? 'GATEWAY AWAKENING…' : cinematic.phase==='flight' ? 'RIDING THE STARLIGHT' : 'ARRIVING…' : hint };
    },
    recovery(player) {
      return visiting && player.position.y - 2.05 < 60 ? SKY_ARRIVAL : null;
    },
    reset() { visiting = pressed = awakened = secret = false; transition = cinematic = null; }
  };
}

// Lake on the ground beneath the island: its four waterfalls land here.
export const SKY_LAKE = Object.freeze({ x: SKY.x + 2, z: SKY.z - 2, level: 1, radius: 31 });
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function skyLakeArea(x, z, margin = 0) {
  return Math.hypot(x - SKY_LAKE.x, z - SKY_LAKE.z) < 44 + margin;
}
// Heavenly Falls fountain rim: a walkable stone ring around the basin.
export const HEAVENLY_RIM = Object.freeze({ x: SKY_LAKE.x, z: SKY_LAKE.z, top: 1.65, bottom: 0.6, solid: true,
  width: 63.2, depth: 63.2, inner: 30.4, outer: 31.6,
  contains(px, pz, pad = 0) { const d = Math.hypot(px - SKY_LAKE.x, pz - SKY_LAKE.z); return d > 30.4 - pad && d < 31.6 + pad; } });
// Shallow wadeable bowl (1.4 m deep), then a level plaza at 1.6 m out to 38 m before
// blending back into the generated land.
export function skyLakeTerrain(x, z, original) {
  const d = Math.hypot(x - SKY_LAKE.x, z - SKY_LAKE.z);
  if (d >= 44) return original;
  const bed = SKY_LAKE.level - 1.4 * (1 - smooth(18, 30, d)) + 0.6 * smooth(28, 33, d);
  return original + (bed - original) * (1 - smooth(38, 44, d));
}
