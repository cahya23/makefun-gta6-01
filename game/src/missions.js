// Five story missions for Raka and Mira's crew, with steps, targets, rewards
// and progression. A mission is a small state machine: each step names a place
// to reach or a thing to do, and finishing it pays money and respect.
export const MISSIONS = [
  {
    id: 1, title: 'First Delivery', reward: 200,
    intro: 'Mira needs a package taken to the harbour pier. Drive or walk there — no police attention.',
    steps: [
      { text: 'Pick up the package at the plaza fountain', target: { x: 0, z: 0 }, radius: 6 },
      { text: 'Deliver the package to the harbour pier (south-east)', target: { x: 96, z: 146 }, radius: 8 },
    ],
  },
  {
    id: 2, title: 'Borrowed Wheels', reward: 350,
    intro: 'The crew needs a fast car. Steal any parked car with E and bring it to the garage.',
    steps: [
      { text: 'Steal a parked car (walk up to one and press E)', target: null, needCar: true },
      { text: 'Drive the stolen car to the garage on Palm Row', target: { x: -64, z: 64 }, radius: 8 },
    ],
  },
  {
    id: 3, title: 'Harbour Pickup', reward: 500,
    intro: 'Rival crew members are guarding a crate at the harbour. Grab it and get out.',
    steps: [
      { text: 'Reach the crate yard at the harbour', target: { x: 96, z: 140 }, radius: 9 },
      { text: 'Grab the crate, then return to the plaza', target: { x: 0, z: 0 }, radius: 8 },
    ],
  },
  {
    id: 4, title: 'Heat Run', reward: 800,
    intro: 'The police are closing in. Make some noise, hit 3 stars, then lose them at the hideout.',
    steps: [
      { text: 'Raise your wanted level to 3 stars (steal a car or cause trouble)', target: null, needWanted: 3 },
      { text: 'Lose the police, then reach the hideout', target: { x: -96, z: -96 }, radius: 9 },
    ],
  },
  {
    id: 5, title: 'The Sunport Heist', reward: 1500,
    intro: 'The big one: hit the Sunport vault, grab the cash, and escape to the beach hideout.',
    steps: [
      { text: 'Reach the Sunport vault downtown', target: { x: 32, z: -32 }, radius: 8 },
      { text: 'Grab the cash (stay at the vault for 5 seconds)', target: { x: 32, z: -32 }, radius: 8, holdSeconds: 5 },
      { text: 'Escape to the beach hideout — the police will be all over you', target: { x: -96, z: 122 }, radius: 9 },
    ],
  },
];

/** Start the next unplayed mission; returns the mission or null when done. */
export function startNextMission(state, audio) {
  if (state.missionIndex >= MISSIONS.length) return null;
  const def = MISSIONS[state.missionIndex];
  state.missionActive = {
    id: def.id, title: def.title, reward: def.reward,
    step: 0, holdTimer: 0, text: def.steps[0].text,
    target: def.steps[0].target,
  };
  state.message = 'Mission: ' + def.title + ' — ' + def.intro;
  state.messageUntil = state.elapsed + 6;
  if (audio) audio.playMissionStart();
  return def;
}

/** Current step definition of the active mission, or null. */
export function currentStep(state) {
  if (!state.missionActive) return null;
  const def = MISSIONS[state.missionActive.id - 1];
  return def.steps[state.missionActive.step];
}

/**
 * Advance the active mission one frame. Returns 'done' when the mission pays out,
 * 'step' when a step completes, or null. `hooks` supplies the world callbacks.
 */
export function updateMission(state, dt, hooks) {
  const m = state.missionActive;
  if (!m) return null;
  const def = MISSIONS[m.id - 1];
  const step = def.steps[m.step];
  const p = state.player;

  if (step.needCar && !p.onFoot) return completeStep(state, hooks);
  if (step.needWanted && state.wanted >= step.needWanted) return completeStep(state, hooks);

  if (step.target) {
    const d = Math.hypot(p.x - step.target.x, p.z - step.target.z);
    if (step.holdSeconds) {
      if (d < step.radius) {
        m.holdTimer += dt;
        m.text = step.text + ' — ' + Math.ceil(step.holdSeconds - m.holdTimer) + 's';
        if (m.holdTimer >= step.holdSeconds) return completeStep(state, hooks);
      } else {
        m.holdTimer = 0;
        m.text = step.text;
      }
    } else if (d < step.radius) {
      return completeStep(state, hooks);
    }
  }
  return null;
}

function completeStep(state, hooks) {
  const m = state.missionActive;
  const def = MISSIONS[m.id - 1];
  if (hooks && hooks.onStep) hooks.onStep(m, def);
  m.step += 1;
  m.holdTimer = 0;
  if (m.step >= def.steps.length) {
    // mission complete: pay out, mark done, advance the story
    state.money += def.reward;
    state.respect += 15 + def.id * 5;
    state.missionDone[def.id - 1] = true;
    state.missionIndex = Math.max(state.missionIndex, def.id);
    state.stats.missionsDone += 1;
    state.missionActive = null;
    state.message = 'Mission complete: ' + def.title + ' — earned $' + def.reward;
    state.messageUntil = state.elapsed + 5;
    if (hooks && hooks.onComplete) hooks.onComplete(def);
    return 'done';
  }
  const next = def.steps[m.step];
  m.text = next.text;
  m.target = next.target || null;
  state.message = 'Next: ' + next.text;
  state.messageUntil = state.elapsed + 4;
  return 'step';
}

/** World position of the current mission target, for the beacon and minimap. */
export function missionTarget(state) {
  if (!state.missionActive) return null;
  return state.missionActive.target;
}

/** Short label for the HUD objective line. */
export function missionLabel(state) {
  if (!state.missionActive) {
    if (state.missionIndex >= MISSIONS.length) return { title: 'Story Complete', text: 'You pulled off the Sunport Heist. Free roam Solmar Bay!' };
    return { title: 'Free Roam', text: 'Press M to start: ' + MISSIONS[state.missionIndex].title };
  }
  return { title: state.missionActive.title, text: state.missionActive.text };
}
