const LS_KEY = 'haikyuu_bindings_v1';

export const DEFAULT_BINDINGS = {
  p1: {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    action: 'ShiftLeft',
    diveLeft: null, diveRight: null, block: null,
  },
  p2: {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    action: 'ShiftRight',
    diveLeft: null, diveRight: null, block: null,
  },
};

// null = use double-tap; display strings for null state
export const DOUBLE_DEFAULTS = {
  p1: { diveLeft: 'AA(더블탭)', diveRight: 'DD(더블탭)', block: 'WW(더블탭)' },
  p2: { diveLeft: '←←(더블탭)', diveRight: '→→(더블탭)', block: '↑↑(더블탭)' },
};

const KEY_DISPLAY = {
  ShiftLeft: 'L.Shift', ShiftRight: 'R.Shift',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab',
  Backspace: 'BS', Delete: 'Del', CapsLock: 'Caps',
  ControlLeft: 'L.Ctrl', ControlRight: 'R.Ctrl',
  AltLeft: 'L.Alt', AltRight: 'R.Alt',
  BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
  Slash: '/', Backslash: '\\', Minus: '-', Equal: '=',
};

export function keyName(code) {
  if (!code) return '—';
  if (KEY_DISPLAY[code]) return KEY_DISPLAY[code];
  if (code.startsWith('Key'))    return code.slice(3);
  if (code.startsWith('Digit'))  return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  if (code.startsWith('F') && !isNaN(code.slice(1))) return code;
  return code;
}

let _current = null;
export function getBindings()          { return _current ?? DEFAULT_BINDINGS; }
export function setCurrentBindings(b)  { _current = b; }

export function loadBindings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        p1: { ...DEFAULT_BINDINGS.p1, ...parsed.p1 },
        p2: { ...DEFAULT_BINDINGS.p2, ...parsed.p2 },
      };
    }
  } catch {}
  const b = structuredClone(DEFAULT_BINDINGS);
  saveBindings(b);
  return b;
}

export function saveBindings(b) {
  localStorage.setItem(LS_KEY, JSON.stringify(b));
}

export function buildKeysMap(b) {
  return {
    '1P_LEFT': b.p1.left, '1P_RIGHT': b.p1.right,
    '1P_UP':   b.p1.up,   '1P_DOWN':  b.p1.down,
    '1P_ACTION': b.p1.action, '1P_CONFIRM': 'Enter',
    '2P_LEFT': b.p2.left, '2P_RIGHT': b.p2.right,
    '2P_UP':   b.p2.up,   '2P_DOWN':  b.p2.down,
    '2P_ACTION': b.p2.action, '2P_CONFIRM': 'Enter',
  };
}

export function buildDirectMap(b) {
  const direct = {};
  const pairs = [
    ['p1', 'diveLeft',  '1P_DOUBLE_LEFT'],
    ['p1', 'diveRight', '1P_DOUBLE_RIGHT'],
    ['p1', 'block',     '1P_DOUBLE_UP'],
    ['p2', 'diveLeft',  '2P_DOUBLE_LEFT'],
    ['p2', 'diveRight', '2P_DOUBLE_RIGHT'],
    ['p2', 'block',     '2P_DOUBLE_UP'],
  ];
  for (const [player, action, inputName] of pairs) {
    const code = b[player][action];
    if (code) direct[code] = inputName;
  }
  return direct;
}
