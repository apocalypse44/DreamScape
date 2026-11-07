import { createPerson } from './person.js';

// Character holograms: any people-kit character drawn as a hollow glow with scanlines and a flicker
// (rim-lit, additive). uGlitch tears it sideways in world-height bands; uColor sets its hue.
// The skinning chunks are no-ops for plain meshes, so props and animated bodies share one shader.
export const HOLOGRAM_SHADER = {
  vertexShader: `uniform float uTime,uGlitch;varying vec3 vN;varying float vY;
    #include <common>
    #include <skinning_pars_vertex>
    void main(){
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      vec4 w=modelMatrix*vec4(transformed,1.);
      float band=floor(w.y*5.);w.x+=uGlitch*(fract(sin(band*91.7+floor(uTime*24.))*43758.5)-.5)*1.2;
      vN=normalize(normalMatrix*objectNormal);vY=w.y;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `uniform float uTime,uOpacity,uChaos;uniform vec3 uColor;varying vec3 vN;varying float vY;
    void main(){float rim=pow(1.-abs(vN.z),1.8);float scan=.65+.35*sin(vY*38.-uTime*5.);
      float flicker=.85+.15*sin(uTime*23.)*sin(uTime*7.3);
      vec3 col=mix(uColor*.55,mix(uColor,vec3(1.),.6),rim);
      gl_FragColor=vec4(col,(.1+rim*.75)*scan*flicker*uOpacity*(1.+uChaos*.7));}`,
};
export const hologramUniforms = (color = 0x9d6bff) => ({
  uTime: { value: 0 }, uGlitch: { value: 0 }, uOpacity: { value: 1 }, uChaos: { value: 0 }, uColor: { value: new THREE.Color(color) },
});

// name: a people-kit recipe; clip: its pose; eyes: two bright points on the face (villains glare).
// uniforms: share one set to drive several holograms together (the border anchor glitches its own).
export function createHologram({ name, colors = null, clip = 'Idle_Loop', scale = 1, color, uniforms = hologramUniforms(color), eyes = false }) {
  const look = { ...HOLOGRAM_SHADER, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending };
  const plain = new THREE.ShaderMaterial(look), skinned = new THREE.ShaderMaterial({ ...look, skinning: true });
  const person = createPerson({ name, colors });
  person.root.scale.setScalar(scale);
  person.play(clip, 0, false);
  person.ready.then(() => {
    person.root.traverse(o => { if (o.isMesh) { o.material = o.isSkinnedMesh ? skinned : plain; o.castShadow = o.receiveShadow = false; } });
    if (!eyes) return;
    const face = person.model?.getObjectByName('socket_face'), glow = new THREE.MeshBasicMaterial({ color: 0xf6eeff, toneMapped: false });
    for (const x of [-.077, .077]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), glow); eye.position.set(x, 1.728, .205); face?.add(eye); }
  });
  return {
    root: person.root, person, uniforms,
    /** advance: false when the uniforms' time is driven elsewhere (shared uniforms). */
    update(dt, advance = true) { if (advance) uniforms.uTime.value += dt; person.update(dt); },
  };
}
