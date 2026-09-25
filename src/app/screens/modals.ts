import { type Lang, t, tDeep } from '../../core/i18n';
import { FACILITIES } from '../../data/facilities';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { App } from '../App';
import type { Quality } from '../../render/Renderer';

export function settingsModal(app: App, onChange?: () => void) {
  const s = app.settings;
  const slider = (id: string, label: string, value: number, apply: (v: number) => void) =>
    h('label', { class: 'row between' },
      h('span', { class: 'eyebrow', style: { minWidth: '120px' } }, label),
      h('input', { type: 'range', id, min: 0, max: 1, step: 0.05, value, class: 'grow', onInput: (e) => apply(Number((e.target as HTMLInputElement).value)) }),
    );
  const toggle = (id: string, label: string, value: boolean, apply: (v: boolean) => void) =>
    h('label', { class: 'row between', style: { cursor: 'pointer' } },
      h('span', null, label),
      h('input', { type: 'checkbox', id, checked: value, onChange: (e) => apply((e.target as HTMLInputElement).checked) }),
    );
  const select = <T extends string>(id: string, label: string, value: T, options: [T, string][], apply: (v: T) => void) =>
    h('label', { class: 'row between' },
      h('span', null, label),
      h('select', { class: 'select', id, onChange: (e) => apply((e.target as HTMLSelectElement).value as T) },
        options.map(([v, l]) => { const o = h('option', { value: v }, l); if (v === value) o.selected = true; return o; })),
    );
  const exportArea = h('textarea', { class: 'input', style: { width: '100%', minHeight: '70px', fontSize: '11px', userSelect: 'text' }, placeholder: t('Paste a save code here to import it') }) as HTMLTextAreaElement;
  app.ui.modal({
    title: t('Settings'),
    body: h('div', { class: 'col' },
      select<Lang>('set-lang', t('Language'), s.lang, [['de', 'Deutsch'], ['en', 'English']], (v) => { app.applySettings({ lang: v }); onChange?.(); }),
      select<Quality>('set-quality', t('Graphics quality'), s.quality, [['low', t('Low')], ['medium', t('Medium')], ['high', t('High')]], (v) => app.applySettings({ quality: v })),
      slider('set-master', t('Master volume'), s.master, (v) => app.applySettings({ master: v })),
      slider('set-music', t('Music'), s.music, (v) => app.applySettings({ music: v })),
      slider('set-sfx', t('Effects'), s.sfx, (v) => app.applySettings({ sfx: v })),
      toggle('set-voice', t('Auctioneer voice'), s.voice, (v) => app.applySettings({ voice: v })),
      slider('set-sens', t('Look sensitivity'), s.sensitivity / 2, (v) => app.applySettings({ sensitivity: Math.max(0.2, v * 2) })),
      toggle('set-invert', t('Invert vertical look'), s.invertY, (v) => app.applySettings({ invertY: v })),
      toggle('set-hints', t('Show control hints'), s.hints, (v) => app.applySettings({ hints: v })),
      h('div', { class: 'sep' }),
      h('span', { class: 'eyebrow' }, t('Save game')),
      h('p', { class: 'note' }, app.game.save.backend instanceof Object && (app.game.save.backend as { available?: boolean }).available === false
        ? t('Your browser blocks storage here, so progress lasts only while this page is open. Export a save code to keep it.')
        : t('The game saves automatically after every important action. You can also copy a save code as a backup.')),
      exportArea,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn small', onClick: () => {
          exportArea.value = app.game.save.exportString(app.game.state);
          exportArea.select();
          navigator.clipboard?.writeText(exportArea.value).then(() => app.ui.toast(t('Save code copied.'), 'good'), () => app.ui.toast(t('Save code ready. Select and copy it.'), 'info'));
        } }, icon('down', 14), t('Export save code')),
        h('button', { class: 'btn small', onClick: () => {
          const st = app.game.save.importString(exportArea.value);
          if (!st) { app.ui.toast(t('That save code is not valid.'), 'bad'); return; }
          app.game.state = st;
          app.game.flushSave();
          app.ui.toast(t('Save imported.'), 'good');
          app.ui.closeAllModals();
          app.route('hub');
        } }, icon('up', 14), t('Import save code')),
      ),
    ),
    actions: [{ label: t('Done'), kind: 'primary', onClick: () => true }],
  });
}

export function facilitiesModal(app: App) {
  const level = app.game.level();
  app.ui.modal({
    title: t('Storage facilities'),
    sub: t('Where you hunt'),
    wide: true,
    body: h('div', { class: 'col' },
      FACILITIES.map((f) => {
        const locked = !f.playable || level < f.minLevel;
        return h('div', { class: ['lot-card', locked ? 'done' : f.id === app.game.state.facilityId ? 'current' : ''] },
          h('div', { class: 'lot-door', style: { background: `repeating-linear-gradient(180deg, ${f.doorColor} 0 6px, rgba(0,0,0,.25) 6px 8px)` } }, locked ? icon('lock', 22) : icon('pin', 22)),
          h('div', { class: 'lot-meta' },
            h('b', null, t(f.name)),
            h('div', { class: 'line' }, t(f.tagline)),
            h('div', { class: 'line faint' }, f.playable ? t(f.description) : t('Coming in a future expansion. Requires level {n}.', { n: f.minLevel })),
          ),
          h('div', { class: 'lot-result' }, f.playable ? h('span', { class: 'chip solid' }, t('Open')) : h('span', { class: 'chip' }, t('Locked'))),
        );
      }),
    ),
  });
}

export function newsModal(app: App) {
  const news = app.game.state.news.slice(0, 40);
  const kindIcon: Record<string, string> = { market: 'chart', sale: 'cash', rumor: 'eye', info: 'info', warning: 'alert', quest: 'book' };
  app.ui.modal({
    title: t('News & messages'),
    body: news.length === 0
      ? h('p', { class: 'note' }, t('Nothing new.'))
      : h('div', { class: 'col', style: { gap: '6px' } }, news.map((n) =>
        h('div', { class: 'row', style: { alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--line)' } },
          icon(kindIcon[n.kind] ?? 'info', 16),
          h('div', { class: 'grow' }, h('div', null, tDeep(n.text, n.p)), h('span', { class: 'faint', style: { fontSize: '12px' } }, t('Day {n}', { n: n.day }))),
        ))),
  });
}
