// Three occupied levels around a tall central atrium. Thin floor slabs and
// separate stair slots leave real headroom; collision is shared with rendering.
export const CASTLE_LEVELS = [
  { top: 16.12, name: 'LANTERN ATRIUM', purpose: 'Gather the swarm · border-anchor staging' },
  { top: 23.12, name: 'TESTIMONY ARCHIVE', purpose: 'Recover the three stolen memories' },
  { top: 30.12, name: 'HOLLOW CROWN OBSERVATORY', purpose: 'Inspect the Triad’s protected bindings' },
];
export const CASTLE_FLOORS = [1, 2].flatMap(level => {
  const top = CASTLE_LEVELS[level].top;
  return [
    { u: 150, v: -11, width: 50, depth: 8 },
    { u: level === 1 ? 161 : 137, v: 11, width: level === 1 ? 28 : 24, depth: 8 },
    { u: 127, v: 0, width: 4, depth: 30 },
    { u: 172, v: 0, width: 6, depth: 30 },
    ...(level===1?[{u:148,v:0,width:4,depth:30}]:[]),
  ].map(p => ({ ...p, name: 'gallery', bottom: top - 0.35, top, solid: true }));
});
export const CASTLE_STAIRS = [0, 1].map(i => {
  const start = 128 + i * 22, end = start + 18, low = CASTLE_LEVELS[i].top, top = CASTLE_LEVELS[i+1].top;
  return { name: 'stair', u: (start+end)/2, v: 11, width: end-start, depth: 4.2, bottom: low-0.2, top, solid: true,
    start, end, low, topAt: (x, z) => low+(top-low)*Math.max(0, Math.min(1, (-344-x-start)/(end-start))) };
});
export const CASTLE_RAILS = [1, 2].flatMap(level => {
  const floor=CASTLE_LEVELS[level].top;
  return [
    ...(level===1?[{u:138,v:-7,width:14,depth:0.2},{u:159.5,v:-7,width:17,depth:0.2}]:[{u:149,v:-7,width:38,depth:0.2}]),
    {u:level===1?160:139,v:7,width:level===1?18:20,depth:0.2},
    {u:169,v:0,width:0.2,depth:14},
    {u:129,v:0,width:0.2,depth:14},
    ...(level===1?[{u:145.9,v:0,width:.2,depth:14},{u:150.1,v:0,width:.2,depth:14}]:[]),
  ].map(p=>({...p,name:'balustrade',bottom:floor,top:floor+1.1,solid:true}));
});
export const CASTLE_PROPS = [
  ...[135,146,157].map(u=>({name:'archive',u,v:-13.6,width:4,depth:1.4,bottom:23.12,height:3.8})),
  {name:'archive-chest',u:163,v:-10.5,width:2,depth:1.3,bottom:23.12,height:1.5},
  ...[-8,0,8].map(v=>({name:'binding',u:174,v,width:1.6,depth:1.6,bottom:30.12,height:1.1})),
];
export const CASTLE_RECORDS = [
  { id:'root',u:135,v:-11,top:23.12,title:'CLOVER · THE FALSE ANCHORS',text:'The Root Sigil reveals true bindings among the Triad’s decoys. Seek Iven at the Rootkeeper Archive.' },
  { id:'tide',u:146,v:-11,top:23.12,title:'HEART · THE STOLEN CURRENT',text:'Heart’s stolen water magic replenishes the Crown’s shield. Sera and the water spirit can cut its supply.' },
  { id:'prism',u:157,v:-11,top:23.12,title:'DIAMOND · THE INVERSION',text:'The workers concealed an inversion circuit inside their chains. Orin’s Prism Sigil can expose the armor.' },
];
export const CASTLE_ROUTE = [
  {u:128,v:0,top:16.12},{u:128,v:11,top:16.12},{u:146,v:11,top:23.12},
  {u:150,v:11,top:23.12},{u:168,v:11,top:30.12},{u:172,v:11,top:30.12},
  {u:172,v:-11,top:30.12},{u:132,v:-11,top:30.12},
];
export function castleVolumes() {
  return [...CASTLE_FLOORS,...CASTLE_STAIRS,...CASTLE_RAILS,
    ...CASTLE_PROPS.map(p=>({...p,top:p.bottom+p.height,solid:true}))]
    .map(p=>({...p,x:-344-p.u,z:p.v}));
}
export function createCastleDiscovery() {
  const found = new Set(); let inspected=false;
  return {
    get count(){return found.size;}, get complete(){return found.size===3&&inspected;},
    get objective(){return found.size<3?'Read the three testimonies in the first-floor archive.'
      :!inspected?'Climb to the observatory and inspect the three bindings.'
      :'Return to Neris. The border anchor must fall before the journey north.';},
    update(position,chaos){
      if(chaos>.4)return null;
      const feet=position.y-2.05;
      for(const record of CASTLE_RECORDS) if(!found.has(record.id)&&Math.abs(feet-record.top)<1&&Math.hypot(position.x+344+record.u,position.z-record.v)<2.8){
        found.add(record.id);return {title:record.title,text:record.text};
      }
      if(found.size===3&&!inspected&&Math.abs(feet-30.12)<1&&Math.hypot(position.x+516,position.z)<4){
        inspected=true;return {title:'THE HOLLOW CROWN',text:'Veyr hides the true anchors. Sile feeds the shield. Morcant seals the armor. The swarm needs all three openings. First, free the border settlement with Neris.'};
      }
      return null;
    },
    reset(){found.clear();inspected=false;},
  };
}

export function createCastleRecovery() {
  let checkpoint=null;
  return {
    update(player){
      const {x,y,z}=player.position,feet=y-2.05;
      const inside=x<-468&&x>-522&&Math.abs(z)<16;
      if(!inside){checkpoint=null;return null;}
      if(player.grounded)for(const floor of CASTLE_FLOORS){
        if(Math.abs(feet-floor.top)<.2&&Math.abs(-344-x-floor.u)<floor.width/2&&Math.abs(z-floor.v)<floor.depth/2)
          checkpoint={x:-344-(floor.top>29?172:148),z:11,top:floor.top};
      }
      // Descending a staircase briefly marks the player airborne. A nearby
      // support below the feet is an intentional descent, not an atrium fall.
      const supported=[...CASTLE_FLOORS,...CASTLE_STAIRS].some(p=>{
        if(Math.abs(-344-x-p.u)>p.width/2+.55||Math.abs(z-p.v)>p.depth/2+.55)return false;
        const top=p.topAt?p.topAt(x,z):p.top;
        return feet-top<.8&&feet-top>-.2;
      });
      if(supported)return null;
      if(checkpoint&&!player.grounded&&player.velocity.y<0&&feet<checkpoint.top-5)return {...checkpoint};
      return null;
    },
    reset(){checkpoint=null;},
  };
}
