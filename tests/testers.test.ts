import { describe, expect, it } from 'vitest';
import { canRooms, canTest, emailHash, isCreatorAccount, setCreatorAccount, setTesterList } from '../src/game/meta';

const wait = () => new Promise((r) => setTimeout(r, 20));

describe('testers', () => {
  it('creador, tester con salas, tester sin salas y cuenta normal', async () => {
    setTesterList({ [await emailHash('Amigo@Correo.com ')]: true, [await emailHash('otra@correo.com')]: false });
    setCreatorAccount('rodrigoamericarp@gmail.com'); await wait();
    expect([isCreatorAccount(), canTest(), canRooms()]).toEqual([true, true, true]);
    setCreatorAccount('amigo@correo.com'); await wait();
    expect([isCreatorAccount(), canTest(), canRooms()]).toEqual([false, true, true]);
    setCreatorAccount('otra@correo.com'); await wait();
    expect([canTest(), canRooms()]).toEqual([true, false]);
    setCreatorAccount('nadie@correo.com'); await wait();
    expect([canTest(), canRooms()]).toEqual([false, false]);
    setCreatorAccount(null); await wait();
    expect(canTest()).toBe(false);
  });
});
