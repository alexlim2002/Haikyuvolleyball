const LS_KEY = 'haikyuu_sound_v1';
const DEFAULTS = { bgm: true, sfx: true };

export function loadSoundSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function saveSoundSettings(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}
