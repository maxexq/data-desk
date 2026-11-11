// The game's own right-click menu. Any component calls showMenu(event, items).
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { create } from 'zustand';
import { Icon, type IconName } from './icons';

export type MenuItem =
  | { separator: true }
  | { separator?: false; label: string; icon?: IconName; checked?: boolean; disabled?: boolean; onSelect: () => void };

interface MenuState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  open: (x: number, y: number, items: MenuItem[]) => void;
  close: () => void;
}

export const useMenu = create<MenuState>((set) => ({
  menu: null,
  open: (x, y, items) => set({ menu: { x, y, items } }),
  close: () => set({ menu: null }),
}));

/** Text the player may want to copy or paste keeps the browser's own menu. */
export const wantsNativeMenu = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('input, textarea, a, .cm-editor, .sel');

export function showMenu(e: MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  useMenu.getState().open(e.clientX, e.clientY, items);
}

export function ContextMenu() {
  const menu = useMenu((s) => s.menu);
  const close = useMenu((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);

  // Keep the menu on screen, then move focus into it so the keyboard works.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !menu) return;
    el.style.left = `${Math.max(4, Math.min(menu.x, window.innerWidth - el.offsetWidth - 4))}px`;
    el.style.top = `${Math.max(4, Math.min(menu.y, window.innerHeight - el.offsetHeight - 4))}px`;
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [menu, close]);

  if (!menu) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') buttons[(i + 1) % buttons.length]?.focus();
    else if (e.key === 'ArrowUp') buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    else if (e.key === 'Home') buttons[0]?.focus();
    else if (e.key === 'End') buttons[buttons.length - 1]?.focus();
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className="ctx raised" role="menu" style={{ left: menu.x, top: menu.y }} onKeyDown={onKeyDown} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="ctx-sep" role="separator" />
        ) : (
          <button
            key={i}
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked}
            className="ctx-item"
            disabled={item.disabled}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            <span className="ctx-mark">{item.checked ? <Icon name="check" size={12} /> : item.icon ? <Icon name={item.icon} /> : null}</span>
            <span>{item.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
