// Fase H6: recetas de efectos por hechizo y modelo animado del Arquero.
import { describe, expect, it } from 'vitest';
import { SPELL_CATALOG, catalogSpells } from '../src/content/spellCatalog';
import { PLAYABLE } from '../src/core/classes/classes';
import { SPELLS } from '../src/core/classes/spells';
import { CLASS_FX, FxLayer, SPELL_FX, fxCells, recipeFor } from '../src/render/fx';
import { ANIM_FRAMES, MODEL_CLASSES, animFor, modelFrame, type Anim } from '../src/render/models';

describe('H6 · recetas de efectos', () => {
  it('cada clase jugable tiene paleta y proyectil propios, distintos entre sí', () => {
    for (const c of PLAYABLE) expect(CLASS_FX[c], c).toBeTruthy();
    expect(new Set(PLAYABLE.map((c) => `${CLASS_FX[c]!.color}/${CLASS_FX[c]!.proj}`)).size).toBe(PLAYABLE.length);
  });
  it('los ajustes por hechizo apuntan a hechizos que existen', () => {
    for (const id of Object.keys(SPELL_FX)) expect(SPELLS[id], id).toBeTruthy();
  });
  it('las 112 habilidades del catálogo tienen una receta coherente', () => {
    let n = 0;
    for (const c of PLAYABLE) for (const id of catalogSpells(c)) {
      const d = SPELLS[id]!, r = recipeFor(d, c);
      n++;
      if (d.target === 'self') { expect(r.travel, id).toBe('none'); expect(r.onSelf, id).not.toBe('none'); }
      else expect(r.travel, id).not.toBe('none');
      if (d.range[1] <= 1 && d.target !== 'self' && !SPELL_FX[id]?.travel) expect(r.travel, id).toBe('instant');
      expect(r.color).toMatch(/^#/);
    }
    expect(n).toBe(112);
  });
  it('el elemento manda en el color y los golpes fuertes hacen temblar', () => {
    expect(recipeFor(SPELLS.a_ignea!, 'arquero').color).toBe('#ff8a30');
    expect(recipeFor(SPELLS.b_colosal!, 'barbaro').shake).toBeGreaterThan(0);
    expect(recipeFor(SPELLS.flecha!, 'arquero').proj).toBe('arrow');
    expect(recipeFor(SPELLS.g_disparo!, 'pistolero').proj).toBe('bullet');
  });
  it('áreas: rombo, cuadrado y línea', () => {
    const from = { x: 2, y: 2 }, at = { x: 5, y: 2 };
    expect(fxCells(SPELLS.s_bruma!, from, at, 12, 8)).toHaveLength(5); // área 1 en rombo
    expect(fxCells(SPELLS.b_cuchillada!, from, from, 12, 8)).toHaveLength(8); // 3×3 alrededor (sin el centro)
    expect(fxCells(SPELLS.flecha!, from, at, 12, 8)).toEqual([at]);
    const line = fxCells(SPELLS.t_vacio!, from, at, 12, 8);
    expect(line.every((p) => p.y === 2 && p.x > 2)).toBe(true);
  });
  it('la capa de efectos lanza, impacta y se vacía sola', () => {
    const fx = new FxLayer(56);
    const hit = fx.cast(recipeFor(SPELLS.a_letal!, 'arquero'), { x: 1, y: 1 }, { x: 7, y: 1 }, [{ x: 7, y: 1 }], 1000);
    expect(hit).toBeGreaterThan(1000);
    expect(fx.busy(1001)).toBe(true);
    fx.hit({ x: 7, y: 1 }, true, hit);
    expect(fx.busy(hit + 5000)).toBe(true); // aún guarda las listas hasta el siguiente dibujo
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    fx.draw(g, hit + 5000);
    expect(fx.busy(hit + 5000)).toBe(false);
    expect(fx.offset(hit + 5000)).toEqual([0, 0]);
  });
});

describe('H6 · modelo animado del Arquero', () => {
  it('el Arquero ya usa modelo de 32×32 con todas sus animaciones', () => {
    expect(MODEL_CLASSES).toContain('arquero');
    for (const a of Object.keys(ANIM_FRAMES) as Anim[]) for (let f = 0; f < ANIM_FRAMES[a]; f++) {
      const g = modelFrame('arquero', a, f);
      expect(g).toHaveLength(32);
      expect(g.flat().filter(Boolean).length, `${a}${f}`).toBeGreaterThan(60);
    }
    // tensa el arco: la cuerda cambia entre fotogramas del ataque
    expect(JSON.stringify(modelFrame('arquero', 'attack', 0))).not.toBe(JSON.stringify(modelFrame('arquero', 'attack', 2)));
  });
  it('todas las habilidades del Arquero tienen gesto propio', () => {
    for (const id of catalogSpells('arquero')) expect(['attack', 'cast', 'special']).toContain(animFor(id, !!SPELLS[id]!.dmg));
    expect(SPELL_CATALOG.arquero!.starters).toContain('flecha');
  });
});
