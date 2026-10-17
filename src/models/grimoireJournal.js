// Read live quest state without inventing completion or future campaign rewards.
export function grimoireQuests(quest, spade) {
  const stage=quest.stage,embers=quest.embers.filter(e=>e.taken).length;
  const archive=spade?.castle.discovery.count??0;
  const witness=Boolean(spade?.echo.recovered),crown=Boolean(spade?.castle.discovery.complete);
  return [
    {id:'hound',chapter:'I · THE CROSSING',title:'The Ember Hound',done:stage==='cured',locked:false,
      progress:stage==='companion'?'Your companion walks beside you.':`${embers}/3 embers gathered`,
      hint:stage==='cured'?'The hound is free. Your bond has survived the curse.'
        :stage==='return'?'Return to the Grimoire Tower shrine. Become still to offer the three embers.'
        :stage==='cursed'?(quest.houndCarrying?'Follow the hound to the embers. Chaos raises their peaks; approach the hound calmly for the ember it carries.'
          :'Gather the remaining embers, then return to the shrine. Chaos reveals their high resting places.')
        :'Explore with your companion. Walk softly and approach calmly; E lets you pet it. If chaos awakens its curse, the shrine knows the cure.',
      stamp:'PACT RESTORED',destination:'quest'},
    {id:'archive',chapter:'II · THE SPADE KINGDOM',title:'The Stolen Testimonies',done:archive===3,locked:false,
      progress:`${archive}/3 testimonies restored`,
      hint:archive===3?'Clover, Heart and Diamond’s testimonies are inscribed in your grimoire.'
        :'Enter Spade castle and take the left-side stairs to the first-floor archive. Approach each of the three records in calm.',
      stamp:'TRUTH INSCRIBED',destination:'spade-castle'},
    {id:'witness',chapter:'II · THE SPADE KINGDOM',title:'The Erased Witness',done:witness,locked:false,
      progress:witness?'Veyr’s hidden memory restored':`${spade?.echo.progress??0}/5 chaos landings`,
      hint:witness?'The witness exposed Veyr’s false anchors. The memory will remain with you.'
        :spade?.echo.engaged?spade.echo.objective
        :'At the archive’s north balcony, sprint and jump into chaos. Cross the five fractured arches, then become still on the final seal.',
      stamp:'MEMORY UNBOUND',destination:'spade-castle'},
    {id:'crown',chapter:'II · THE SPADE KINGDOM',title:'The Hollow Crown',done:crown,locked:!crown&&(archive<3||!witness),
      progress:crown?'The three bindings understood':'Crown Observatory · floor 2',
      hint:crown?'You understand the Triad’s stolen currents. Return to Neris to follow the story.'
        :archive<3||!witness?'Restore all three archive testimonies and the erased witness first. Then inspect the bindings in calm on the second floor.'
        :'Climb to the second-floor observatory. Approach the three bindings at the rear of the hall in calm.',
      stamp:'BINDINGS REVEALED',destination:'spade-castle'},
  ];
}
