// Modelos animados de las clases nuevas: tamaño, fotogramas y Sombra.
import { describe, expect, it } from 'vitest';
import { ANIM_FRAMES, MODEL_CLASSES, MODEL_SIZE, animFor, modelFrame, type Anim } from '../src/render/models';
import { CLASSES } from '../src/core/classes/classes';

describe('modelos animados', () => {
  it('existen para las 5 clases nuevas y no para las antiguas', () => {
    // H6: el Arquero también tiene modelo animado
    expect([...MODEL_CLASSES].sort()).toEqual(['acechador', 'arquero', 'arquitecto', 'barbaro', 'carcelero', 'esferas', 'pistolero', 'zorro']);
    for (const c of MODEL_CLASSES) expect(CLASSES[c as keyof typeof CLASSES]).toBeTruthy();
  });
  it('todos los fotogramas miden 32×32 y tienen dibujo', () => {
    for (const c of MODEL_CLASSES) for (const a of Object.keys(ANIM_FRAMES) as Anim[]) for (let f = 0; f < ANIM_FRAMES[a]; f++) {
      const g = modelFrame(c, a, f);
      expect(g).toHaveLength(MODEL_SIZE);
      expect(g.every((r) => r.length === MODEL_SIZE)).toBe(true);
      expect(g.flat().filter(Boolean).length).toBeGreaterThan(60);
    }
  });
  it('las animaciones cambian entre fotogramas', () => {
    for (const c of MODEL_CLASSES) for (const a of ['idle', 'attack', 'death'] as Anim[]) {
      expect(JSON.stringify(modelFrame(c, a, 0))).not.toBe(JSON.stringify(modelFrame(c, a, 2)));
    }
  });
  it('la Sombra es un clon oscuro que conserva los ojos rojos', () => {
    const g = modelFrame('acechador', 'idle', 0, 'shadow').flat();
    expect(g).toContain('#ff3a4a');
    expect(g).not.toContain('#c8303a');
  });
  it('cada hechizo de las clases nuevas tiene su animación', () => {
    expect(animFor('z_encanto', false)).toBe('special');
    expect(animFor('t_dispersion', true)).toBe('special');
    expect(animFor('k_sentencia', true)).toBe('attack');
    expect(animFor('s_shuriken', true)).toBe('cast');
    expect(animFor('cualquiera', true)).toBe('attack');
  });
});
