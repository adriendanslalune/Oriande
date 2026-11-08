// A fight, turn by turn, on a page of the explorer's atlas laid over the map: the monster
// (engraved placeholder until its illustration arrives), its life and the explorer's, what just
// happened, and three choices: attack, use something from the pack, or run. The rules are in
// game/combat.ts; this scene only shows them and reads the player's choice.
import Phaser from 'phaser';
import { t } from '../i18n';
import { ITEMS, monsterById, playTurn, type Action, type Beat } from '../game/combat';
import type { GameState } from '../game/state';
import { drawMonster } from '../render/monsterArt';

export interface BattleData {
  state: GameState;
  /** called after each beat, so that the map's header shows the explorer's life as it changes */
  changed: (hp: number) => void;
  /** called when the page closes (the fight is over), with how it ended */
  done: (outcome: 'won' | 'fled' | 'lost') => void;
}

const CSS = `
.battle { position: fixed; inset: 0; z-index: 10; background: rgba(42,36,29,.35); display: flex; align-items: center; justify-content: center;
  padding: calc(10px + env(safe-area-inset-top, 0px)) 10px calc(10px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
.battle .page { width: 100%; max-width: 440px; max-height: 100%; overflow: auto; background: #ece3cb; color: #2a241d; border: 1.5px solid #2a241d;
  outline: 1px solid #2a241d; outline-offset: 4px; padding: 14px 16px 16px; box-sizing: border-box; font: 15px/1.35 "IM Fell English", serif;
  box-shadow: 0 6px 30px rgba(0,0,0,.35); }
.battle .kicker { font: 12px "IM Fell English SC", serif; letter-spacing: .12em; text-align: center; color: #6a5f4f; }
.battle h2 { margin: 2px 0 2px; font: 700 22px/1.15 "Old Standard TT", serif; text-align: center; text-transform: uppercase; letter-spacing: .03em; }
.battle .lore { font-style: italic; text-align: center; color: #6a5f4f; margin: 0 0 6px; font-size: 14px; }
.battle canvas { display: block; margin: 0 auto; width: 240px; height: 200px; }
.battle .gauge { margin: 6px 0; }
.battle .gauge .row { display: flex; justify-content: space-between; font: 13px "IM Fell English SC", serif; letter-spacing: .05em; }
.battle .bar { height: 9px; border: 1px solid #2a241d; background: #f4ecd6; position: relative; }
.battle .bar i { position: absolute; left: 0; top: 0; bottom: 0; transition: width .45s ease;
  background: repeating-linear-gradient(-55deg, #2a241d 0 1.2px, transparent 1.2px 4px), rgba(168,52,40,.55); }
.battle .bar.you i { background: repeating-linear-gradient(-55deg, #2a241d 0 1.2px, transparent 1.2px 4px), rgba(88,120,70,.6); }
.battle .log { min-height: 44px; margin: 8px 0; padding: 6px 8px; border-top: 1px solid #2a241d; border-bottom: 1px solid #2a241d; font-style: italic; }
.battle .log p { margin: 0; }
.battle .log p:not(:last-child) { color: #8a7f6f; }
.battle .acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.battle .acts.items { grid-template-columns: 1fr; }
.battle button { font: 700 15px/1.2 "Old Standard TT", serif; color: #2a241d; background: #ece3cb; border: 1.5px solid #2a241d;
  padding: 11px 6px; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; touch-action: manipulation; }
.battle button:disabled { opacity: .4; }
.battle button:active:not(:disabled) { background: #e2d7ba; }
.battle button i { display: block; font: italic 400 12px "IM Fell English", serif; text-transform: none; letter-spacing: 0; color: #6a5f4f; }
.battle .shake { animation: oriande-shake .32s; }
@keyframes oriande-shake { 20% { transform: translateX(-7px); } 45% { transform: translateX(6px); } 70% { transform: translateX(-3px); } }
.battle .fig { position: relative; }
.battle .float { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); font: 700 22px "Old Standard TT", serif; color: #a83428;
  pointer-events: none; animation: oriande-float .9s forwards; }
@keyframes oriande-float { to { transform: translate(-50%, -40px); opacity: 0; } }
`;

/** Pause between the beats of a turn, ms (the player reads what happens). */
const BEAT_MS = 650;

export class BattleScene extends Phaser.Scene {
  private data0!: BattleData;
  private root!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private busy = false;
  private t0 = 0;

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.data0 = data;
    this.busy = false;
  }

  create(): void {
    const s = this.data0.state, b = s.battle!, m = monsterById(b.monster)!;
    const style = document.createElement('style');
    style.textContent = CSS;
    this.root = document.createElement('div');
    this.root.className = 'battle';
    this.root.innerHTML = `<div class="page" role="dialog" aria-modal="true">
      <div class="kicker"></div><h2></h2><p class="lore"></p>
      <div class="fig"><canvas></canvas></div>
      <div class="gauge foe"><div class="row"><span class="n"></span><span class="v"></span></div><div class="bar"><i></i></div></div>
      <div class="log" aria-live="polite"></div>
      <div class="gauge you"><div class="row"><span class="n"></span><span class="v"></span></div><div class="bar you"><i></i></div></div>
      <div class="acts"></div></div>`;
    this.root.prepend(style);
    this.q('.kicker').textContent = t('battle.title');
    this.q('h2').textContent = t(`monster.${m.id}.name`);
    this.q('.lore').textContent = t(`monster.${m.id}.text`);
    this.q('.gauge.foe .n').textContent = t(`monster.${m.id}.name`);
    this.q('.gauge.you .n').textContent = t('battle.you');
    this.canvas = this.q('canvas') as HTMLCanvasElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = 240 * dpr; this.canvas.height = 200 * dpr;
    document.body.append(this.root);
    this.say([t('battle.appears', { m: t(`monster.${m.id}.the`) })]);
    this.refresh();
    this.choices();
    this.t0 = performance.now();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.root.remove());
  }

  update(): void {
    // the monster breathes and moves a little
    const g = this.canvas.getContext('2d')!, dpr = this.canvas.width / 240;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = this.data0.state.battle;
    if (b) drawMonster(g, b.monster, 240, 200, (performance.now() - this.t0) / 1000);
  }

  private q(sel: string): HTMLElement { return this.root.querySelector(sel) as HTMLElement; }

  /** Life gauges and the purse, from the state. */
  private refresh(): void {
    const s = this.data0.state, b = s.battle;
    if (b) this.gauges(b.hp, monsterById(b.monster)!.hp, s.hp);
  }

  /** The last lines of the fight's story. */
  private say(lines: string[]): void {
    const log = this.q('.log');
    for (const line of lines) { const p = document.createElement('p'); p.textContent = line; log.append(p); }
    while (log.children.length > 3) log.firstChild!.remove();
  }

  private button(label: string, sub: string | null, fn: () => void, disabled = false): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    if (sub) { const i = document.createElement('i'); i.textContent = sub; b.append(i); }
    b.disabled = disabled;
    b.addEventListener('click', () => { if (!this.busy) fn(); });
    return b;
  }

  /** Attack, item, flee. */
  private choices(): void {
    const acts = this.q('.acts'), s = this.data0.state;
    acts.className = 'acts';
    const any = Object.values(s.items).some((n) => n > 0);
    acts.replaceChildren(
      this.button(t('battle.attack'), null, () => this.act({ kind: 'attack' })),
      this.button(t('battle.item'), null, () => this.itemChoices(), !any),
      this.button(t('battle.flee'), null, () => this.act({ kind: 'flee' })),
    );
  }

  /** What is in the pack. */
  private itemChoices(): void {
    const acts = this.q('.acts'), s = this.data0.state;
    acts.className = 'acts items';
    const list = ITEMS.filter((it) => (s.items[it.id] ?? 0) > 0).map((it) =>
      this.button(`${t(`item.${it.id}.name`)} × ${s.items[it.id]}`, t('battle.heals', { n: it.heal }), () => this.act({ kind: 'item', item: it.id })));
    acts.replaceChildren(...list, this.button(t('battle.back'), null, () => this.choices()));
  }

  /** Play the turn, then show its beats one after another. */
  private act(a: Action): void {
    const s = this.data0.state, m = s.battle!.monster, max = monsterById(m)!.hp;
    let foeHp = s.battle!.hp, myHp = s.hp; // as the turn starts
    const beats = playTurn(s, a);
    if (!beats.length) return;
    this.busy = true;
    for (const btn of this.root.querySelectorAll('.acts button')) (btn as HTMLButtonElement).disabled = true;
    const name = t(`monster.${m}.the`);
    const show = (k: number): void => {
      if (k >= beats.length) { this.afterTurn(beats); return; }
      const b = beats[k];
      if (b.kind === 'hit' && b.who === 'you') { foeHp = Math.max(0, foeHp - b.damage); this.hitFoe(b.damage); }
      if (b.kind === 'hit' && b.who === 'foe') { myHp = Math.max(0, myHp - b.damage); this.shake(this.q('.page')); }
      if (b.kind === 'heal') myHp += b.amount;
      const line = this.line(b, name);
      if (line) this.say([line]);
      this.gauges(foeHp, max, myHp);
      this.data0.changed(myHp);
      this.time.delayedCall(BEAT_MS, () => show(k + 1));
    };
    show(0);
  }

  /** The two gauges and the purse, as the story of the turn unfolds. */
  private gauges(foeHp: number, foeMax: number, myHp: number): void {
    const s = this.data0.state;
    (this.q('.gauge.foe .bar i')).style.width = (100 * foeHp / foeMax) + '%';
    this.q('.gauge.foe .v').textContent = `${foeHp} / ${foeMax}`;
    (this.q('.gauge.you .bar i')).style.width = (100 * myHp / s.maxHp) + '%';
    this.q('.gauge.you .v').textContent = `${myHp} / ${s.maxHp} · ${t('battle.gold', { n: s.gold })}`;
  }

  private shake(el: HTMLElement): void { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  private hitFoe(damage: number): void {
    const fig = this.q('.fig');
    this.shake(fig);
    const f = document.createElement('div');
    f.className = 'float'; f.textContent = '−' + damage;
    fig.append(f);
    this.time.delayedCall(900, () => f.remove());
  }

  private line(b: Beat, m: string): string {
    switch (b.kind) {
      case 'hit': return b.who === 'you' ? t('battle.you.hit', { n: b.damage }) : t('battle.foe.hit', { m, n: b.damage });
      case 'miss': return b.who === 'you' ? t('battle.you.miss') : t('battle.foe.miss', { m });
      case 'heal': return t('battle.heal', { i: t(`item.${b.item}.name`), n: b.amount });
      case 'flee': return b.ok ? t('battle.flee.ok') : t('battle.flee.fail');
      case 'won': return t('battle.won', { m, n: b.gold });
      case 'fled': return '';
      case 'lost': return t('battle.lost', { n: b.goldLost });
    }
  }

  /** Next turn, or the end of the fight. */
  private afterTurn(beats: Beat[]): void {
    this.busy = false;
    const end = beats.find((b) => b.kind === 'won' || b.kind === 'fled' || b.kind === 'lost');
    if (!end) { this.refresh(); this.choices(); return; }
    const outcome = end.kind as 'won' | 'fled' | 'lost';
    const acts = this.q('.acts');
    acts.className = 'acts items';
    acts.replaceChildren(this.button(t('battle.continue'), null, () => {
      this.scene.stop();
      this.data0.done(outcome);
    }));
  }
}
