// Read live quest state without inventing completion or future campaign rewards.
export function grimoireQuests(quest, spade) {
  const stage=quest.stage,embers=quest.embers.filter(e=>e.taken).length;
  const archive=spade?.castle.discovery.count??0;
  const witness=Boolean(spade?.echo.recovered),crown=Boolean(spade?.castle.discovery.complete);
  const campaign=spade?.campaign,chapter=campaign?.stage??'meet';
  // Neris's chapter waits for the cure (it never runs ahead of the hound quest).
  const early=stage!=='cured'&&chapter==='meet';
  // Spade castle's doors stay sealed until Neris's chapter is complete.
  const sealed=chapter!=='complete',SEALED='The castle doors are sealed by the Triad’s ward. Finish The Swarm Remembers with Neris to open them.';
  return [
    {id:'hound',chapter:'I · THE CROSSING',title:'The Ember Hound',done:stage==='cured',locked:false,
      progress:stage==='companion'?'Your companion walks beside you.':`${embers}/3 embers gathered`,
      hint:stage==='cured'?'The shrine keeper sends you west to Spade. Find Neris at the Lantern Refuge, the first house on your right beyond the gate. Then investigate the castle archive.'
        :stage==='return'?'Return to the Grimoire Tower shrine. Become still to offer the three embers.'
        :stage==='cursed'?(quest.houndCarrying?'Follow the hound to the embers. Chaos raises their peaks; approach the hound calmly for the ember it carries.'
          :'Gather the remaining embers, then return to the shrine. Chaos reveals their high resting places.')
        :'Explore with your companion. Walk softly and approach calmly; E lets you pet it. If chaos awakens its curse, the shrine knows the cure.',
      stamp:'PACT RESTORED',destination:stage==='cured'?'spade-refuge':'quest'},
    {id:'swarm',chapter:'II · THE SPADE KINGDOM',title:'The Swarm Remembers',done:chapter==='complete',locked:early,
      progress:early?'Begins after the Ember Hound is cured':{meet:'Neris waits at the Lantern Refuge',lanterns:`${campaign?.lit??0}/3 memory lanterns lit`,
        anchor:`${campaign?.strikes??0}/3 strikes on the border anchor`,report:'The border anchor has fallen',complete:'Lantern Sigil earned'}[chapter],
      hint:early?'Cure the Ember Hound at the Grimoire Tower shrine first. Then Neris will receive you in Spade.'
        :{meet:'Enter the Lantern Refuge in calm: the first house on your right beyond the Spade gate.',
        lanterns:'Hold E to gather the wisps and lead them to each dark lantern above the avenue posts. Hold them there while the world is calm.',
        anchor:'At the border-anchor plaza, stir chaos to open the ward, gather the flock, then hold Q so enough wisps strike it together. F recalls them.',
        report:'Return to Neris at the Lantern Refuge in calm.',
        complete:crown?'The Lantern Sigil is yours and the bindings are understood. Go north to Clover and find Iven.'
          :'The Lantern Sigil is yours, but three bindings still shield the Hollow Crown. Enter the castle: read the archive, recover the witness, then inspect the bindings.'}[chapter],
      stamp:'LANTERN SIGIL',destination:chapter==='anchor'?'spade-anchor':chapter==='complete'?'spade-castle':'spade-refuge'},
    {id:'archive',chapter:'II · THE SPADE KINGDOM',title:'The Stolen Testimonies',done:archive===3,locked:sealed,
      progress:sealed?'The castle doors are sealed':`${archive}/3 testimonies restored`,
      hint:archive===3?'Clover, Heart and Diamond’s testimonies are inscribed in your grimoire.'
        :sealed?SEALED
        :'Enter Spade castle and take the left-side stairs to the first-floor archive. Approach each of the three records in calm.',
      stamp:'TRUTH INSCRIBED',destination:'spade-castle'},
    {id:'witness',chapter:'II · THE SPADE KINGDOM',title:'The Erased Witness',done:witness,locked:sealed,
      progress:witness?'Veyr’s hidden memory restored':sealed?'The castle doors are sealed':`${spade?.echo.progress??0}/5 chaos landings`,
      hint:witness?'The witness exposed Veyr’s false anchors. The memory will remain with you.'
        :sealed?SEALED
        :spade?.echo.engaged?spade.echo.objective
        :'At the archive’s north balcony, sprint and jump into chaos. Cross the five fractured arches, then become still on the final seal.',
      stamp:'MEMORY UNBOUND',destination:'spade-castle'},
    {id:'crown',chapter:'II · THE SPADE KINGDOM',title:'The Hollow Crown',done:crown,locked:!crown&&(sealed||archive<3||!witness),
      progress:crown?'The three bindings understood':'Crown Observatory · floor 2',
      hint:crown?'You understand the Triad’s stolen currents. Go north to Clover and find Iven at the Rootkeeper Archive.'
        :sealed?SEALED
        :archive<3||!witness?'Restore all three archive testimonies and the erased witness first. Then inspect the bindings in calm on the second floor.'
        :'Climb to the second-floor observatory. Approach the three bindings at the rear of the hall in calm.',
      stamp:'BINDINGS REVEALED',destination:'spade-castle'},
  ];
}
