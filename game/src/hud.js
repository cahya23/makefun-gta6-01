// HUD: every DOM readout — money, health, wanted stars, clock, objective,
// speedometer and toasts — updated from the game state each frame.
import { formatMoney, formatClock } from './state.js';
import { missionLabel } from './missions.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const refs = {
    hud: el('hud'), money: el('money'), respect: el('respect'),
    vehLabel: el('veh-label'), healthFill: el('healthfill'), healthNum: el('health-num'),
    ammo: el('ammo'), stars: el('stars'), clock: el('clock'), dayLabel: el('day-label'),
    missionTitle: el('mission-title'), missionText: el('mission-text'),
    toast: el('toast'), speedNum: el('speed-num'), speedGear: el('speed-gear'),
    crosshair: el('crosshair'),
    startScreen: el('start-screen'), pauseScreen: el('pause-screen'), endScreen: el('end-screen'),
    endTitle: el('end-title'), endText: el('end-text'),
  };
  let lastToast = '';
  return {
    refs,
    showGame() {
      refs.hud.classList.add('on');
      refs.startScreen.style.display = 'none';
      refs.pauseScreen.style.display = 'none';
      refs.endScreen.style.display = 'none';
    },
    showStart() {
      refs.hud.classList.remove('on');
      refs.startScreen.style.display = 'flex';
      refs.pauseScreen.style.display = 'none';
      refs.endScreen.style.display = 'none';
    },
    showPause(on) { refs.pauseScreen.style.display = on ? 'flex' : 'none'; },
    showEnd(title, text) {
      refs.hud.classList.remove('on');
      refs.endTitle.textContent = title;
      refs.endText.textContent = text;
      refs.endScreen.style.display = 'flex';
      refs.pauseScreen.style.display = 'none';
    },
    /** Refresh every readout from the state; cheap enough to run each frame. */
    update(state) {
      refs.money.textContent = formatMoney(state.money);
      refs.respect.textContent = String(state.respect);
      refs.healthFill.style.width = Math.max(0, state.health) + '%';
      refs.healthNum.textContent = String(Math.max(0, Math.ceil(state.health)));
      refs.ammo.textContent = String(state.ammo);
      refs.vehLabel.textContent = state.player.onFoot
        ? 'On foot' : 'Driving: ' + (state.player.car ? state.player.car.name : 'car');
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
      refs.stars.textContent = stars;
      refs.stars.style.opacity = state.wanted > 0 ? '1' : '0.35';
      refs.clock.textContent = formatClock(state.time);
      refs.dayLabel.textContent = 'Solmar Bay · Day ' + state.day;
      const label = missionLabel(state);
      refs.missionTitle.textContent = label.title;
      refs.missionText.textContent = label.text;
      if (state.message && state.elapsed < state.messageUntil) {
        if (state.message !== lastToast) { refs.toast.textContent = state.message; lastToast = state.message; }
      } else if (lastToast !== '') { refs.toast.textContent = ''; lastToast = ''; }
      const speed = state.player.onFoot
        ? Math.abs(state.player.speed) * 3.6
        : Math.abs(state.player.car ? state.player.car.speed : 0) * 3.6;
      refs.speedNum.textContent = String(Math.round(speed));
      refs.speedGear.textContent = state.player.onFoot
        ? (speed > 1 ? 'ON FOOT' : 'STANDING')
        : (state.player.car && state.player.car.speed > 1 ? 'DRIVING' : state.player.car && state.player.car.speed < -1 ? 'REVERSING' : 'PARKED');
      refs.crosshair.style.display = state.player.onFoot && state.ammo > 0 && state.screen === 'play' ? 'block' : 'none';
    },
  };
}
