// Touch screens have no right button. A long press opens the same menus a right-click does.
// Android browsers already fire `contextmenu` on long press and iOS Safari does not, so this
// sends one only when the browser has not, and drops the browser's if ours came first.

const HOLD_MS = 550;
const SLOP = 10; // px a finger may wander before it counts as a scroll or drag

let timer: ReturnType<typeof setTimeout> | null = null;
let start: { x: number; y: number } | null = null;
let lastNative = 0;
let lastOurs = 0;

const cancel = () => {
  if (timer) clearTimeout(timer);
  timer = null;
  start = null;
};

/** True just after a long press, so the tap that ends it does not also open or click something. */
export const justLongPressed = () => Date.now() - lastOurs < 700 || Date.now() - lastNative < 700;

export function installTouch() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      cancel();
      const target = e.target as Element;
      start = { x: e.clientX, y: e.clientY };
      const { clientX, clientY } = e;
      timer = setTimeout(() => {
        timer = null;
        if (Date.now() - lastNative < HOLD_MS) return;
        lastOurs = Date.now();
        target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY }));
      }, HOLD_MS);
    },
    { passive: true },
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancel();
    },
    { passive: true },
  );
  document.addEventListener('pointerup', cancel, { passive: true });
  document.addEventListener('pointercancel', cancel, { passive: true });

  document.addEventListener(
    'contextmenu',
    (e) => {
      if (!e.isTrusted) return; // ours
      if (Date.now() - lastOurs < 800) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastNative = Date.now();
      cancel();
    },
    true,
  );

  // The finger lifting after a long press must not click whatever it is now over (the menu).
  document.addEventListener(
    'click',
    (e) => {
      if (Date.now() - lastOurs < 700) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
}
