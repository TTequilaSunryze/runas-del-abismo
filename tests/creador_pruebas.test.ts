import { describe, expect, it } from 'vitest';
import { DUMMY_HP, MAX_DUMMIES, isTraining, metaAction, newTraining, pendingOf } from '../src/game/run';
import { catalogSpells } from '../src/content/spellCatalog';
import { creatorOn, setCreatorAccount, isCreatorAccount } from '../src/game/meta';

describe('sala de pruebas', () => {
  it('crea héroe con todas las habilidades y un muñeco de vida enorme', () => {
    const run = newTraining('TEST', 7, 'me', 'Yo', 'carcelero');
    expect(isTraining(run)).toBe(true);
    expect(run.arena).toBeTruthy();
    const me = run.combat!.units.find((u) => u.owner === 'me')!;
    expect(me.spells.map((s) => s.id)).toEqual(catalogSpells('carcelero'));
    const d = run.combat!.units.find((u) => u.traits?.includes('dummy'))!;
    expect(d.hp).toBe(DUMMY_HP);
  });
  it('herramientas: muñecos, recarga, esperas, clase', () => {
    const run = newTraining('TEST', 7, 'me', 'Yo', 'arquero');
    for (let i = 0; i < 10; i++) metaAction(run, 'me', { a: 'train', op: `dummy:${(i % 6) + 1}` });
    expect(run.combat!.units.filter((u) => u.traits?.includes('dummy')).length).toBeLessThanOrEqual(MAX_DUMMIES);
    const me = run.combat!.units.find((u) => u.owner === 'me')!;
    me.ap = 0; me.spells[0]!.cd = 3;
    expect(metaAction(run, 'me', { a: 'train', op: 'refill' })).toBeNull();
    expect(metaAction(run, 'me', { a: 'train', op: 'cd' })).toBeNull();
    expect(me.ap).toBe(me.maxAp); expect(me.spells[0]!.cd).toBe(0);
    const d = run.combat!.units.find((u) => u.traits?.includes('dummy'))!;
    d.hp -= 500;
    metaAction(run, 'me', { a: 'train', op: 'heal' });
    expect(d.hp).toBe(d.maxHp);
    expect(metaAction(run, 'me', { a: 'train', op: 'cls:barbaro' })).toBeNull();
    expect(run.heroes[0]!.cls).toBe('barbaro');
  });
  it('fuera de la sala no se aceptan herramientas', () => {
    const run = newTraining('TEST', 7, 'me', 'Yo', 'arquero');
    run.flags = [];
    expect(metaAction(run, 'me', { a: 'train', op: 'refill' })).not.toBeNull();
  });
});

describe('modo creador', () => {
  it('solo la cuenta de creador puede activarlo', () => {
    setCreatorAccount('otro@x.com');
    expect(isCreatorAccount()).toBe(false);
    expect(creatorOn({ creator: true })).toBe(false);
    setCreatorAccount('RodrigoAmericarp@gmail.com ');
    expect(creatorOn({ creator: true })).toBe(true);
    expect(creatorOn({ creator: false })).toBe(false);
    setCreatorAccount(null);
  });
});

describe('santuario', () => {
  it('la mejora pendiente se etiqueta como del santuario', () => {
    const run = newTraining('TEST', 7, 'me', 'Yo', 'carcelero');
    run.room = { kind: 'shrine' } as never;
    run.heroes[0]!.bossOffer = [] as never;
    expect(pendingOf(run, run.heroes[0]!).join(' ')).toContain('santuario');
  });
});
