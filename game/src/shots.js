// Screenshot staging behind ?shot=chase|street|mission|start. Each scene puts
// the real game into a state that shows its systems — a police chase, a street
// full of traffic and pedestrians, a mission firefight, or the start screen —
// then lets it run live for a couple of seconds so the frame is genuinely played.
export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

/**
 * Stage a shot scene on the live game object. `game` is the object main.js
 * exposes (state, startGame, spawn helpers). Called once at boot for ?shot=.
 */
export function stageShotScene(game, name) {
  const state = game.state;
  if (name === 'start') {
    state.screen = 'start';
    return 'start';
  }
  game.startGame(true);
  if (name === 'chase') {
    // driving fast down Palm Avenue (road x=0), 3 stars, police already on the tail
    game.placePlayerInCar(0, -20, 0);
    state.wanted = 3;
    state.wantedHeat = 90;
    state.missionActive = {
      id: 4, title: 'Heat Run', reward: 800, step: 1, holdTimer: 0,
      text: 'Lose the police, then reach the hideout', target: { x: -96, z: -96 },
    };
    game.spawnPoliceNow(2);
    game.setPlayerSpeed(26);
    state.message = 'WANTED — 3 stars! Lose the Bay Police!';
    state.messageUntil = 9999;
  } else if (name === 'mission') {
    // on foot at the harbour crate yard, mission 3 active, rivals closing in
    game.placePlayerOnFoot(88, 132, -Math.PI * 0.4);
    state.missionActive = {
      id: 3, title: 'Harbour Pickup', reward: 500, step: 0, holdTimer: 0,
      text: 'Reach the crate yard at the harbour', target: { x: 96, z: 140 },
    };
    game.spawnEnemiesNow(3);
    state.ammo = 48;
    state.message = 'Mission: Harbour Pickup — rivals guard the crate!';
    state.messageUntil = 9999;
  } else {
    // street: on foot at the plaza, traffic and pedestrians all around
    game.placePlayerOnFoot(8, 14, Math.PI * 0.8);
    state.message = 'Solmar Bay — explore on foot or steal a car (E)';
    state.messageUntil = 9999;
  }
  return name;
}
