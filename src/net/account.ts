// Cuenta opcional (email y contraseña): guarda el progreso en la nube para no perderlo al cambiar de dispositivo.
import { mergeMeta, meta, myTeam, replaceMeta, saveMeta, setSaveHook, type Meta } from '../game/meta';
import { supabase } from './transport';

export interface Account {
  id: string;
  email: string;
  name: string;
}

let account: Account | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
export const currentAccount = (): Account | null => account;

const NAME_RE = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ-]{3,14}$/;
const errText = (m: string): string =>
  /Invalid login/i.test(m) ? 'Email o contraseña incorrectos.'
  : /already registered|already been registered/i.test(m) ? 'Ya existe una cuenta con ese email.'
  : /not confirmed/i.test(m) ? 'Falta confirmar el email: abre el enlace que te enviamos.'
  : /at least 6|Password should/i.test(m) ? 'La contraseña debe tener al menos 6 caracteres.'
  : /rate limit|too many/i.test(m) ? 'Demasiados intentos. Espera unos minutos.'
  : /valid email|invalid format/i.test(m) ? 'Ese email no es válido.'
  : /duplicate|profiles_name_key/i.test(m) ? 'Ese nombre de cuenta ya está cogido.'
  : /fetch|network/i.test(m) ? 'Sin conexión con el servidor.'
  : m;

async function push(): Promise<void> {
  if (!account) return;
  const m = meta();
  await supabase().from('profiles').update({ meta: m, team: myTeam(), updated_at: new Date().toISOString() }).eq('user_id', account.id);
}

/** Tras entrar: carga (o crea) el perfil y deja el progreso local igual al de la cuenta. */
async function attach(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Promise<string | null> {
  const db = supabase();
  let { data: row, error } = await db.from('profiles').select('name, meta').eq('user_id', user.id).maybeSingle();
  if (error) return errText(error.message);
  const local = meta();
  if (!row) {
    const name = String(user.user_metadata?.name ?? '').trim();
    if (!NAME_RE.test(name)) return 'Nombre de cuenta no válido (3 a 14 letras o números, sin espacios).';
    local.acct = user.id;
    const ins = await db.from('profiles').insert({ user_id: user.id, name, meta: local, team: myTeam() }).select('name, meta').single();
    if (ins.error) return errText(ins.error.message);
    row = ins.data;
  }
  const cloud = (row!.meta ?? {}) as Partial<Meta>;
  // primer uso de esta cuenta en este navegador: se une todo; después manda lo más reciente
  if (local.acct !== user.id) replaceMeta({ ...mergeMeta(local, cloud), acct: user.id });
  else if ((cloud.t ?? 0) > local.t && cloud.v === 1) replaceMeta({ ...(cloud as Meta), acct: user.id });
  account = { id: user.id, email: user.email ?? '', name: row!.name as string };
  setSaveHook(() => { if (timer) clearTimeout(timer); timer = setTimeout(() => void push(), 1500); });
  saveMeta();
  return null;
}

/** Recupera la sesión guardada en este navegador, si la hay. */
export async function restoreAccount(): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    if (data.session?.user) await attach(data.session.user);
  } catch { /* sin conexión: se sigue como invitado */ }
}

export async function signUp(email: string, password: string, name: string): Promise<string | null> {
  name = name.trim();
  if (!NAME_RE.test(name)) return 'El nombre de cuenta debe tener de 3 a 14 letras o números, sin espacios.';
  try {
    const { data, error } = await supabase().auth.signUp({ email: email.trim(), password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
    if (error) return errText(error.message);
    if (!data.session || !data.user) return 'Cuenta creada. Abre el enlace de confirmación que te hemos enviado por email y después pulsa Entrar.';
    return await attach(data.user);
  } catch (e) {
    return errText((e as Error).message);
  }
}

export async function signIn(email: string, password: string): Promise<string | null> {
  try {
    const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) return errText(error?.message ?? 'No se pudo entrar.');
    return await attach(data.user);
  } catch (e) {
    return errText((e as Error).message);
  }
}

export async function signOut(): Promise<void> {
  if (timer) clearTimeout(timer);
  await push().catch(() => {});
  setSaveHook(null);
  account = null;
  try { await supabase().auth.signOut(); } catch { /* da igual */ }
}

/** Equipo de duelo de otro jugador, por su nombre de cuenta. */
export async function fetchTeam(name: string): Promise<{ name: string; team: unknown[] } | null> {
  try {
    const { data, error } = await supabase().rpc('get_team', { p_name: name.trim() });
    const d = data as { name: string; team: unknown[] } | null;
    return error || !d || !Array.isArray(d.team) ? null : d;
  } catch {
    return null;
  }
}
