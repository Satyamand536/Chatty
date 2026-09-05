/**
 * Local multiplayer input.
 *
 * Phase 3: one shared screen, 1-4 cooks. Two input devices can drive a cook at once and
 * the last one to speak wins for that player:
 *
 *   - keyboard: a fixed key cluster per player, so 2 players can share a laptop and
 *     4 can share a full keyboard (numpad included)
 *   - gamepad: pad index N drives player N, polled every frame via the Gamepad API
 *
 * Touch adds a virtual stick for player 0 only (a phone has one screen and one thumb).
 *
 * Nothing here touches the simulation. This module produces PlayerInput values; the sim
 * consumes them. Keeping it separate means the input scheme can change without a single
 * gameplay line moving, and it can be tested without a browser.
 */

export interface FrameInput {
  moveX: number;
  moveY: number;
  actHeld: boolean;
  actPressed: boolean;
  pingPressed: boolean;
}

/** Keys currently down. Populated from real keydown/keyup once attached. */
export const keysDown = new Set<string>();

/** Player 0's virtual stick, written by the on-screen touch controls. */
export const touch = { x: 0, y: 0, act: false };

/**
 * Key cluster per player index. Chosen so players 0 and 1 sit on opposite hands of a
 * laptop keyboard, and 2 and 3 land on the numpad of a full-size one.
 *
 * `act` is deliberately a single hold key: hold-to-progress is the whole interaction model,
 * so there is no second button to learn.
 */
export const KEY_MAP: Array<{ up: string; down: string; left: string; right: string; act: string; ping: string }> = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyE', ping: 'KeyQ' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Slash', ping: 'Period' },
  { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', act: 'NumpadEnter', ping: 'Numpad0' },
  { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', act: 'KeyU', ping: 'KeyO' },
];

/** Human-readable labels for the on-screen legend. */
export const KEY_LABELS: Array<{ move: string; act: string; ping: string }> = [
  { move: 'W A S D', act: 'E', ping: 'Q' },
  { move: 'ARROWS', act: '/', ping: '.' },
  { move: 'NUM 8 4 5 6', act: 'NUM ENTER', ping: 'NUM 0' },
  { move: 'I J K L', act: 'U', ping: 'O' },
];

/** Gamepad buttons, per the standard mapping. */
const GP_ACT = 0; // A / cross
const GP_PING = 2; // X / square

const pressedThisFrame = new Set<string>();
const wasDown = new Set<string>();

/**
 * Drops ALL input state. Needed, not cosmetic: clearing keysDown alone leaves wasDown
 * populated, so after an alt-tab the next press of an already-wasDown key reads as
 * "still held" and the first ping is silently swallowed.
 */
export function resetInput(): void {
  keysDown.clear();
  wasDown.clear();
  pressedThisFrame.clear();
  touch.x = 0;
  touch.y = 0;
  touch.act = false;
}

/** Call once per frame before reading inputs, to compute edge transitions. */
export function beginFrame(): void {
  pressedThisFrame.clear();
  for (const c of keysDown) if (!wasDown.has(c)) pressedThisFrame.add(c);
  wasDown.clear();
  for (const c of keysDown) wasDown.add(c);
}

/** True only on the frame the key goes down, so an Act press is never swallowed by holding. */
function edge(code: string): boolean {
  return keysDown.has(code) && pressedThisFrame.has(code);
}

function keyboardInput(i: number): FrameInput | null {
  const k = KEY_MAP[i];
  if (!k) return null;
  let x = (keysDown.has(k.right) ? 1 : 0) - (keysDown.has(k.left) ? 1 : 0);
  let y = (keysDown.has(k.down) ? 1 : 0) - (keysDown.has(k.up) ? 1 : 0);
  const act = keysDown.has(k.act);
  const ping = edge(k.ping);
  if (x === 0 && y === 0 && !act && !ping) return null; // this player is idle on keyboard
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { moveX: x, moveY: y, actHeld: act, actPressed: act, pingPressed: ping };
}

interface GamepadLike {
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean; touched: boolean; value: number }>;
}

/** Reads pad `i`. Returns null when no pad is connected at that index. */
export function gamepadInput(i: number): FrameInput | null {
  const get = (globalThis.navigator as Navigator | undefined)?.getGamepads?.bind(globalThis.navigator);
  if (!get) return null;
  let pads: Array<GamepadLike | null>;
  try {
    pads = Array.from(get()) as Array<GamepadLike | null>;
  } catch {
    return null; // some browsers throw if permissions are revoked
  }
  const p = pads[i];
  if (!p || !p.buttons || p.buttons.length === 0) return null;

  // Left stick, with a deadzone so a drifting pad does not walk the cook into a fryer.
  const ax = p.axes[0] ?? 0;
  const ay = p.axes[1] ?? 0;
  const dead = 0.18;
  const x = Math.abs(ax) > dead ? ax : 0;
  const y = Math.abs(ay) > dead ? ay : 0;

  const act = p.buttons[GP_ACT]?.pressed ?? false;
  const ping = p.buttons[GP_PING]?.pressed ?? false;
  if (x === 0 && y === 0 && !act && !ping) return null;
  return { moveX: x, moveY: y, actHeld: act, actPressed: act, pingPressed: ping };
}

/**
 * Combines every device into one input for player `i`. The most-committed device wins:
 * if two people are fighting over one cook, the one actually moving takes it.
 */
export function readPlayerInput(i: number): FrameInput {
  const idle: FrameInput = { moveX: 0, moveY: 0, actHeld: false, actPressed: false, pingPressed: false };
  const kb = keyboardInput(i);
  const gp = gamepadInput(i);
  const t = i === 0 && (touch.x !== 0 || touch.y !== 0 || touch.act)
    ? { moveX: touch.x, moveY: touch.y, actHeld: touch.act, actPressed: touch.act, pingPressed: false }
    : null;

  const strongest = (a: FrameInput | null, b: FrameInput | null): FrameInput | null => {
    if (!a) return b;
    if (!b) return a;
    const mag = (f: FrameInput) => Math.hypot(f.moveX, f.moveY) + (f.actHeld ? 1 : 0);
    return mag(a) >= mag(b) ? a : b;
  };
  return strongest(strongest(kb, gp), t) ?? idle;
}

/** Number of gamepads currently connected, for the lobby display. */
export function connectedPads(): number {
  const get = (globalThis.navigator as Navigator | undefined)?.getGamepads?.bind(globalThis.navigator);
  if (!get) return 0;
  try {
    return Array.from(get()).filter((p) => p && p.buttons && p.buttons.length > 0).length;
  } catch {
    return 0;
  }
}

/** Wires real key events. Called once from main. */
export function attachKeyboard(): void {
  const down = (e: KeyboardEvent) => {
    keysDown.add(e.code);
    // Arrow keys and space scroll the page; stop that without killing the overlay buttons.
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code.startsWith('Numpad')) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => keysDown.delete(e.code);
  globalThis.addEventListener?.('keydown', down);
  globalThis.addEventListener?.('keyup', up);
  // Losing focus must not leave keys logically held down, or half-pressed.
  globalThis.addEventListener?.('blur', resetInput);
}
