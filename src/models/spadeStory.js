export const REFUGE = { u:22, v:-23, top:1.65 };
export const BORDER_ANCHOR = { u:103, v:-48 };
export const SPADE_MAP_LOCATIONS = [
  {id:'spade-refuge',name:'LANTERN REFUGE',x:-344-REFUGE.u,z:REFUGE.v,note:'Neris · beds · supplies',labelY:.29,
    directions:'First house on the north side of the avenue (right as you enter westward). Walk through its open doorway.',
    destination:{x:-366,z:-15,name:'LANTERN REFUGE DOOR'}},
  {id:'spade-anchor',name:'BORDER-ANCHOR PLAZA',x:-344-BORDER_ANCHOR.u,z:BORDER_ANCHOR.v,note:'Chains · animated ward',labelY:.35,
    directions:'Near the top of town, take the north/right side path before the castle retaining wall.',
    destination:{x:-447,z:-40,name:'BORDER-ANCHOR PLAZA'}},
  {id:'spade-castle',name:'HOLLOW GATE / TRIAD',x:-519.75,z:0,note:'Castle hall · thrones on floor 2',labelY:.41,
    directions:'Route ends at the castle door. Hollow Gate, erased portraits and conduits are in the hall. Take the south-side stairs (left on entry): Archive on floor 1, Triad thrones on floor 2.',
    destination:{x:-462,z:0,name:'SPADE CASTLE ENTRANCE'}},
];
export function storyVolumes(height) {
  const y=REFUGE.top;
  const pieces=[
    {u:22,v:-23,width:10,depth:10,bottom:1.5,height:.15,name:'refuge-floor'},
    {u:17,v:-23,width:.35,depth:10,bottom:1.5,height:5},
    {u:27,v:-23,width:.35,depth:10,bottom:1.5,height:5},
    {u:22,v:-28,width:10,depth:.35,bottom:1.5,height:5},
    {u:18.65,v:-18,width:3.3,depth:.35,bottom:1.5,height:5},
    {u:25.35,v:-18,width:3.3,depth:.35,bottom:1.5,height:5},
    {u:22,v:-18,width:3.4,depth:.35,bottom:4.7,height:1.8},
    {u:22,v:-23,width:10,depth:10,bottom:6.5,height:.25,name:'refuge-roof'},
    ...[19.2,22.1].map(u=>({u,v:-25.5,width:2.1,depth:3,bottom:y,height:.6,name:'refuge-bed'})),
    {u:25,v:-25,width:1.8,depth:1.8,bottom:y,height:1.15,name:'refuge-table'},
    {u:25,v:-21.5,width:1.2,depth:1.2,bottom:y,height:1.25,name:'supplies'},
    {u:19,v:-21,width:1.2,depth:1,bottom:y,height:1,name:'supplies'},
    {u:24,v:-20,width:.6,depth:.6,bottom:y,height:2,name:'guide'},
    {u:103,v:-48,width:3.2,depth:3.2,bottom:height(-447),height:2.6,name:'border-anchor'},
    ...[-1,1].flatMap(side=>[-1,1].map(edge=>({u:103+side*5,v:-48+edge*5,width:1,depth:1,bottom:height(-447)-2,height:4.4,name:'anchor-post'}))),
    ...[-8,0,8].map(v=>({u:174,v,width:2.4,depth:2.4,bottom:30.12,height:3.2,name:'triad-throne'})),
  ];
  return pieces.map(p=>({...p,x:-344-p.u,z:p.v,top:p.bottom+p.height,solid:true}));
}
