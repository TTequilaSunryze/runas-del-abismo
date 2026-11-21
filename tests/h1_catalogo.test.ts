// Fase H1: catálogo de 14 habilidades por clase hecho con contenido existente.
import { describe, expect, it } from 'vitest';
import { ALTS, CATALOG_SIZE, SPELL_CATALOG, SPELL_NEEDS, STARTERS, TEMP_FROM, catalogClassOf, catalogSpells, kitProblem, kitWarnings } from '../src/content/spellCatalog';
import { patronsOf } from '../src/content/boons';
import { CLASSES, PLAYABLE } from '../src/core/classes/classes';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { THIRST_PER_FURY } from '../src/core/combat/engine';
import { GRIMOIRE } from '../src/game/archive';

describe('H1 · catálogo de habilidades', () => {
  it('las 8 clases jugables tienen 4 iniciales y como mucho 10 alternativas; lo que falta está contado', () => {
    expect(Object.keys(SPELL_CATALOG).sort()).toEqual([...PLAYABLE].sort());
    for (const c of PLAYABLE) {
      const k = SPELL_CATALOG[c]!;
      expect(k.starters, c).toHaveLength(STARTERS);
      expect(k.alts.length + k.missing, c).toBe(ALTS);
      expect(catalogSpells(c).length, c).toBeLessThanOrEqual(CATALOG_SIZE);
    }
    // huecos reales (contenido por crear en H5)
    expect(Object.fromEntries(PLAYABLE.map((c) => [c, SPELL_CATALOG[c]!.missing]))).toEqual({ zorro: 1, esferas: 0, acechador: 2, carcelero: 0, barbaro: 5, arquitecto: 1, pistolero: 1, arquero: 0 });
  });
  it('solo usa habilidades que ya existen, sin repetir ni mezclar clases, y sin temporales', () => {
    const seen = new Set<string>();
    for (const c of PLAYABLE) for (const id of catalogSpells(c)) {
      expect(SPELLS[id], id).toBeTruthy();
      expect(SPELLS[id]!.route, id).not.toBe('temp');
      expect(seen.has(id), id).toBe(false);
      seen.add(id);
      expect(catalogClassOf(id)).toBe(c);
    }
  });
  it('el kit inicial actual sigue entero entre las iniciales', () => {
    for (const c of PLAYABLE) for (const id of CLASSES[c].base) expect(SPELL_CATALOG[c]!.starters, c).toContain(id);
  });
  it('no se pierde contenido: todo lo que hoy se consigue está en el catálogo o excluido con motivo', () => {
    for (const c of PLAYABLE) {
      const k = SPELL_CATALOG[c]!;
      const now = [...CLASSES[c].routes.flatMap((r) => r.spells), ...patronsOf(c).flatMap((p) => p.spells)].filter((id) => SPELLS[id] && SPELLS[id]!.route !== 'temp');
      for (const id of now) expect(catalogSpells(c).includes(id) || k.excluded.some((e) => e.id === id), `${c}: ${id}`).toBe(true);
      for (const e of k.excluded) { expect(SPELLS[e.id], e.id).toBeTruthy(); expect(catalogSpells(c)).not.toContain(e.id); expect(e.reason.length).toBeGreaterThan(10); }
    }
  });
  it('dependencias y temporales apuntan a habilidades de la misma clase', () => {
    for (const [id, n] of Object.entries(SPELL_NEEDS)) {
      const c = catalogClassOf(id)!;
      expect(c, id).toBeTruthy();
      for (const p of n.anyOf) expect(catalogClassOf(p), `${id} ← ${p}`).toBe(c);
    }
    for (const [temp, from] of Object.entries(TEMP_FROM)) { expect(SPELLS[temp]!.route).toBe('temp'); for (const f of from) expect(catalogClassOf(f)).toBeTruthy(); }
  });
  it('kitProblem valida configuraciones y kitWarnings avisa de recursos sin generador', () => {
    expect(kitProblem('esferas', SPELL_CATALOG.esferas!.starters)).toBeNull();
    expect(kitProblem('esferas', ['t_pulso', 't_pulso', 't_descarga', 't_orbita'])).toMatch(/repitas/);
    expect(kitProblem('esferas', ['t_pulso', 'z_orbe', 't_descarga', 't_orbita'])).toMatch(/clase/);
    expect(kitProblem('esferas', ['t_pulso', 't_descarga'])).toMatch(/4/);
    expect(kitProblem('esferas', ['t_pulso', 't_dispersion', 't_descarga', 't_vacio'], [])).toMatch(/desbloqueado/);
    expect(kitProblem('esferas', ['t_pulso', 't_dispersion', 't_descarga', 't_vacio'], ['t_vacio'])).toBeNull();
    expect(kitWarnings(['t_dispersion', 't_descarga', 't_orbita', 't_vacio']).map((w) => w.id)).toEqual(['t_descarga', 't_orbita']);
    expect(kitWarnings(SPELL_CATALOG.esferas!.starters)).toHaveLength(0);
  });
  it('el Grimorio incluye todo el catálogo', () => {
    const ids = new Set(GRIMOIRE.map((g) => g.id));
    for (const c of PLAYABLE) for (const id of catalogSpells(c)) expect(ids.has(id), id).toBe(true);
  });
  it('no cambia la jugabilidad: el héroe sigue empezando con su kit de 3', () => {
    for (const c of PLAYABLE) expect(makeHero({ cls: c, name: 'x', owner: 'x', routes: [], pos: { x: 0, y: 0 } }).spells.filter((s) => s.charges === undefined).map((s) => s.id).slice(0, 3)).toEqual(CLASSES[c].base);
  });
  it('el texto de Sed de batalla coincide con lo que cura', () => {
    expect(SPELLS.b_sed!.text).toContain(`${Math.round(THIRST_PER_FURY * 100)} por cada 100 de Furia`);
  });
});
