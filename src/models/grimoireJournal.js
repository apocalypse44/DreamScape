// Read live quest state without inventing completion or future campaign rewards.
export function grimoireQuests(quest, spade, clover, diamond, heart) {
  const stage=quest.stage,embers=quest.embers.filter(e=>e.taken).length;
  const archive=spade?.castle.discovery.count??0;
  const witness=Boolean(spade?.echo.recovered),crown=Boolean(spade?.castle.discovery.complete);
  const campaign=spade?.campaign,chapter=campaign?.stage??'meet';
  // Neris's chapter waits for the cure (it never runs ahead of the hound quest).
  const early=stage!=='cured'&&chapter==='meet';
  // Spade castle's doors stay sealed until Neris's chapter is complete.
  const sealed=chapter!=='complete',SEALED='The castle doors are sealed by a Triad spell. Finish Neris’s quest to open them.';
  const diamondStage=diamond?.stage??'meet';
  const diamondLocked=diamondStage==='meet'&&!diamond?.available;
  const heartStage=heart?.stage??'meet';
  const heartLocked=!heart?.available; // no Root Sigil + Tide Hook, no Heart chapter, whatever its stage says
  const fitted=diamond?.fitted??0;
  return [
    {id:'hound',chapter:'I · THE CROSSING',title:'The Ember Hound',done:stage==='cured',locked:false,
      progress:stage==='companion'?'Your companion walks beside you.':`${embers}/3 embers gathered`,
      hint:stage==='cured'?'Go west to Spade. Find Neris at the Lantern Refuge, the first house on your right after the gate.'
        :stage==='return'?'Return to the Grimoire Tower shrine. Become still to offer the three embers.'
        :stage==='cursed'?(quest.houndCarrying?'Follow the hound to the embers. Chaos raises their peaks; approach the hound calmly for the ember it carries.'
          :'Gather the remaining embers, then return to the shrine. Chaos reveals their high resting places.')
        :'Explore with your companion. Walk softly and approach calmly; E lets you pet it. If chaos awakens its curse, the shrine knows the cure.',
      stamp:'PACT RESTORED',destination:stage==='cured'?'spade-refuge':'quest'},
    {id:'swarm',chapter:'II · THE SPADE KINGDOM',title:'The Swarm Remembers',done:chapter==='complete',locked:early,
      progress:early?'Begins after the Ember Hound is cured':{meet:'Neris waits at the Lantern Refuge',lanterns:`${campaign?.lit??0}/3 memory lanterns lit`,
        anchor:`${campaign?.strikes??0}/3 strikes on the border anchor`,report:'The border anchor has fallen',complete:'Lantern Sigil earned'}[chapter],
      hint:early?'Cure the Ember Hound at the Grimoire Tower shrine first. Then Neris will see you in Spade.'
        :{meet:'Walk calmly into the Lantern Refuge: the first house on your right after the Spade gate.',
        lanterns:'Hold E to call the wisps, then walk them to a dark lantern on the main street. Keep them there and stay calm until it lights.',
        anchor:'Go to the border anchor. Run with Shift to stir chaos so its shield opens. Hold E to gather the wisps, then hold Q to send them at it together. F calls them back. Strike 3 times.',
        report:'Walk calmly back to Neris at the Lantern Refuge.',
        complete:crown?'You have the Lantern Sigil and know what protects the Crown. Go north to Clover and find Iven.'
          :'You have the Lantern Sigil, but three spells still protect the Hollow Crown. Go into the castle: read the archive, find the hidden witness, then look at the spells.'}[chapter],
      stamp:'LANTERN SIGIL',destination:chapter==='anchor'?'spade-anchor':chapter==='complete'?'spade-castle':'spade-refuge'},
    {id:'archive',chapter:'II · THE SPADE KINGDOM',title:'The Stolen Testimonies',done:archive===3,locked:sealed,
      progress:sealed?'The castle doors are sealed':`${archive}/3 testimonies restored`,
      hint:archive===3?'All three records are saved in your journal.'
        :sealed?SEALED
        :'Go into Spade castle and take the stairs on the left up to the archive. Walk calmly up to each of the three records.',
      stamp:'TRUTH INSCRIBED',destination:'spade-castle'},
    {id:'witness',chapter:'II · THE SPADE KINGDOM',title:'The Erased Witness',done:witness,locked:sealed,
      progress:witness?'Veyr’s hidden memory restored':sealed?'The castle doors are sealed':`${spade?.echo.progress??0}/5 chaos landings`,
      hint:witness?'The witness showed you Veyr’s fake anchors. You keep this memory.'
        :sealed?SEALED
        :spade?.echo.engaged?spade.echo.objective
        :'In the archive, run and jump to stir chaos. Hidden arches appear past the north balcony. Jump across all five, then stand still on the last one.',
      stamp:'MEMORY UNBOUND',destination:'spade-castle'},
    {id:'crown',chapter:'II · THE SPADE KINGDOM',title:'The Hollow Crown',done:crown,locked:!crown&&(sealed||archive<3||!witness),
      progress:crown?'The three bindings understood':'Crown Observatory · floor 2',
      hint:crown?'You know what protects the Crown. Go north to Clover and find Iven at the Rootkeeper Archive.'
        :sealed?SEALED
        :archive<3||!witness?'First read all three archive records and find the hidden witness. Then go to the top floor and look at the spells.'
        :'Climb to the observatory on the top floor. Walk calmly up to the three spells at the back of the hall.',
      stamp:'BINDINGS REVEALED',destination:'spade-castle'},
    {id:'living-road',chapter:'III · THE CLOVER KINGDOM',title:'The Living Road',done:Boolean(clover?.hook),locked:!clover?.available,
      progress:!clover?.available?'Requires the Lantern Sigil and the Hollow Crown testimony'
        :clover.hook?'Root Sigil and Tide Hook earned':clover.sigil?'Root Sigil earned · Sky Garden chest unlocked'
        :`${clover.generation}/3 root crossings restored`,
      hint:!clover?.available?'Finish Neris’s quest and the castle in Spade first. Then find Iven, west of Clover’s top terrace.'
        :clover.hook?'Clover is done. Talk to Nim, Sera’s scout, by the Clover gate while calm. Then take the Tide Hook east to Heart and find Sera.'
        :clover.sigil?'Go back over the bridges and climb Clover Terraces to the summit. Press E at the glowing gateway to go to the Sky Garden. Follow the Starlight Ledges signs to the highest ledge. Calm down and press E to open Iven’s chest.'
        :clover.generation===3?'Cross the new bridges to the Stormleaf Scar. Calm down and press E to read it.'
        :'Talk to Iven at the Archive. At each stop, press E while calm to turn the guide toward the gold leaf. Then stir chaos and press E to grow the bridge. The path goes west, north, west.',
      stamp:'LIVING ROAD RESTORED',destination:clover?.sigil&&!clover?.hook?'clover-sky-chest':clover?.generation===3&&!clover?.sigil?'clover-scar':'clover-archive'},
    {id:'stolen-current',chapter:'IV · THE HEART KINGDOM',title:'The Stolen Current',done:heartStage==='complete',locked:heartLocked,
      progress:heartLocked?'Requires the Root Sigil and Tide Hook'
        :{meet:heart?.scout&&!heart?.awakened?'Nim waits by the Clover gate':'Sera waits beside the Listening Spring',escort:`${heart?.checkpoints??0}/3 springs restored`,
          report:'The siphon is clear · return to Sera',complete:'Tide Sigil earned'}[heartStage],
      hint:heartLocked?'Find Iven in Clover, restore the Living Road, and take the Tide Hook from the Sky Garden chest. Then travel east to Heart.'
        :{meet:heart?.scout&&!heart?.awakened?'Talk to Nim, Sera’s scout, by the Clover gate while calm. Nim will show you what is happening in Heart.'
          :'In Heart, walk calmly to Sera at the Listening Spring and press E. After you talk to her, hold Q at the floating crystals to swing up the risen islands.',
          escort:heart?.checkpoints===3?'Follow the spirit’s A* route to the siphon core. Calm down and press E there to release the current.'
            :'The water spirit can only walk the islands and bridges. Stir chaos near a hidden switch and press E to raise its crystal bridge; the spirit replans its A* route (hold B for Current Sight to see its search). At each spring, calm down and press E to continue.',
          report:'Carry the Tide Sigil back to Sera in calm. The broken siphon bears a Diamond maker’s mark.',
          complete:'Heart’s current is restored. Travel south to the Diamond Kingdom and find Orin beside the Shatterglass Relay.'}[heartStage],
      stamp:'CURRENT RESTORED',destination:heartStage==='complete'?'diamond-quarry':heartStage==='meet'?(heart?.scout&&!heart?.awakened?'heart-nim':'heart-sera'):'heart-reef'},
    {id:'unbroken-pattern',chapter:'V · THE DIAMOND KINGDOM',title:'The Unbroken Pattern',done:diamondStage==='complete',locked:diamondLocked,
      progress:diamondLocked?'Requires the Tide Sigil from Heart'
        :{meet:'Orin waits beside the Shatterglass Relay',collect:`${diamond?.collected??0}/4 conduit fragments collected`,
          repair:diamond?.jammed?'The relay jammed · refit a fragment':`${fitted}/4 fragments fitted`,
          report:'The workers are free · return to Orin',complete:'Prism Sigil earned'}[diamondStage],
      hint:diamondLocked?'Bring the Tide Sigil from Sera in Heart. Then approach Artificer Orin calmly in Shatterglass Quarry, beyond the Diamond gate.'
        :{meet:'Take the haul ramp down into Shatterglass Quarry. Approach Orin calmly beside the relay on the pit floor.',
          collect:'Go to Artificers’ Row, west of the quarry. Walk calmly near the floating fragment in each of the four workshops to collect it. Then return to the relay.',
          repair:diamond?.jammed?'Stand still to calm down. Press X to lift the last fragment, then stand on a socket and press V to refit it. Stir chaos near the relay to try again.'
            :fitted<4?'While calm, stand on a relay square and press V to fit a fragment. V cycles the last fitted fragment’s available shapes; X lifts it. The numbers count possible shapes for each square, not a matching or addition puzzle. Fit all four fragments.'
            :'All four fragments are fitted. Run with Shift near the relay to stir chaos. The relay fills the remaining squares and sends power to the escape gate and inversion core.',
          report:'Stand still to calm down, then return to Orin beside the relay in the quarry to receive the Prism Sigil.',
          complete:'The workers are free and you carry the Prism Sigil. Return to Spade with all four sigils; the Hollow Crown is waiting.'}[diamondStage],
      stamp:'PRISM SIGIL',destination:diamondStage==='complete'?'spade-castle':diamondStage==='collect'?'diamond-row':'diamond-quarry'},
  ];
}
