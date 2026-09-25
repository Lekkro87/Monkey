import * as THREE from 'three';
import { getLang, money, N_, t, type Lang } from '../../core/i18n';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { App, Controller } from '../App';
import { facilitiesModal, settingsModal } from '../screens/modals';

/** Main menu over a slow dusk dolly along the storage row. */
export class TitleController implements Controller {
  readonly name = 'title';
  private t = 0;

  constructor(private readonly app: App) {}

  enter() {
    const { app } = this;
    app.setHudVisible(false);
    const fs = app.facility;
    const today = app.game.auctions.ensureToday();
    fs.buildRow(today.lots);
    fs.focusLot(today.lots[0]);
    fs.setMood('dusk');
    fs.flashlight.intensity = 0;
    fs.openDoor(0, 0.01);
    for (const f of fs.figures.values()) f.root.visible = false;
    app.showFacility();
    fs.rig.driftAmount = 0.25;
    this.t = 0;
    this.placeCamera(0);
    app.audio.music('menu');
    app.audio.ambience('outdoor');
    this.render();
  }

  private placeCamera(tt: number) {
    const fs = this.app.facility;
    const x = -8 + Math.sin(tt * 0.035) * 7;
    fs.rig.set(new THREE.Vector3(x, 1.7, -8.4), new THREE.Vector3(x + 9, 1.3, -1.2), 52);
  }

  private render() {
    const { app } = this;
    const game = app.game;
    const hasSave = app.game.state.savedAt > 0 || app.game.save.hasSave();
    const cont = hasSave && game.state.day >= 1;
    const item = (label: string, ico: string, onClick: () => void, opts: { primary?: boolean; small?: string; disabled?: boolean } = {}) =>
      h('button', { class: ['menu-item', opts.primary ? 'primary' : ''], disabled: opts.disabled, onClick: () => { app.audio.play('click'); onClick(); } },
        icon(ico, 20), t(label), opts.small ? h('small', null, opts.small) : null);

    const menu = h('div', { class: 'menu' },
      cont
        ? item(N_('Continue'), 'play', () => app.route(game.search.active ? 'search' : 'hub'), { primary: true, small: `${t('Day {n}', { n: game.state.day })} · ${money(game.state.money)}` })
        : item(N_('Play'), 'play', () => this.newGame(), { primary: true }),
      cont ? item(N_('New game'), 'bolt', () => this.confirmNew()) : null,
      item(N_('Storage'), 'pin', () => facilitiesModal(app), { disabled: !cont }),
      item(N_('Inventory'), 'box', () => app.route('inventory'), { disabled: !cont }),
      item(N_('Market'), 'store', () => app.route('market'), { disabled: !cont }),
      item(N_('Garage'), 'garage', () => app.route('garage'), { disabled: !cont }),
      item(N_('Collection'), 'star', () => app.route('collection'), { disabled: !cont }),
      item(N_('Progress'), 'trophy', () => app.route('progress'), { disabled: !cont }),
      item(N_('Settings'), 'gear', () => settingsModal(app, () => this.render())),
    );
    const lang = (l: Lang, label: string) => h('button', {
      class: getLang() === l ? 'active' : '',
      onClick: () => { app.applySettings({ lang: l }); this.render(); },
    }, label);
    app.ui.setScreen(
      h('div', { class: 'title-screen' },
        h('div', null,
          h('div', { class: 'logo' },
            h('div', { class: 'kicker' }, t('Storage auction simulator')),
            h('h1', null, 'Storage', h('span', null, 'Hunter')),
            h('div', { class: 'tag' }, t('"I have no idea what is in there."')),
          ),
          menu,
          h('div', { class: 'title-foot' },
            h('div', { class: 'lang-toggle', role: 'group', ariaLabel: t('Language') }, lang('de', 'DE'), lang('en', 'EN')),
            h('span', null, t('Vertical slice · v0.1')),
          ),
        ),
      ),
    );
  }

  private newGame() {
    this.app.game.newGame();
    this.app.route('hub');
  }

  private async confirmNew() {
    const ok = await this.app.ui.confirm(t('Start a new game?'), t('Your current progress will be overwritten.'), t('Start over'), t('Cancel'), true);
    if (ok) this.newGame();
  }

  exit() {
    this.app.facility.rig.driftAmount = 0;
    for (const f of this.app.facility.figures.values()) f.root.visible = true;
  }

  update(dt: number) {
    this.t += dt;
    this.placeCamera(this.t);
    this.app.facility.update(dt);
  }
}
