import { useEffect, useRef } from 'react';

// Global custom cursor:
//   • dot   — writes the real pointer position synchronously, no frame of lag
//   • ring  — trails the dot with a linear-interp ease (smooth follow)
// Both elements render pointer-events:none at a high z-index.
// Guarded with (pointer: fine) so touch devices skip the RAF loop entirely.
//
// The dot used to be positioned inside the RAF loop alongside the ring. That
// put it a frame behind the pointer, and because the native cursor is hidden
// there is nothing on screen at the true position to compare against, so the
// whole cursor read as laggy. A pointermove handler that writes the transform
// directly is the lowest latency available, and it is what the dot uses now.
export default function CustomCursor() {
  const outlineRef = useRef(null);
  const dotRef     = useRef(null);

  const mouse    = useRef({ x: 0, y: 0 });
  const position = useRef({ x: 0, y: 0 });
  const rafRef   = useRef(0);
  const running  = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;
    // Someone who asks for less motion should not be given a second cursor
    // chasing the first one.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const place = (el, x, y) => {
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    // The ring eases toward the pointer. 0.14 took about seven frames to
    // arrive, which is a visible drag; 0.24 still reads as a smooth follow but
    // stays attached to the pointer rather than being towed behind it.
    const EASE = 0.24;

    const tick = () => {
      const dx = mouse.current.x - position.current.x;
      const dy = mouse.current.y - position.current.y;

      // Settle and stop. The loop used to run at 60fps forever, including
      // while the pointer sat still, which is pure battery for no movement.
      if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15) {
        position.current.x = mouse.current.x;
        position.current.y = mouse.current.y;
        place(outlineRef.current, position.current.x, position.current.y);
        running.current = false;
        return;
      }

      position.current.x += dx * EASE;
      position.current.y += dy * EASE;
      place(outlineRef.current, position.current.x, position.current.y);
      rafRef.current = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (running.current) return;
      running.current = true;
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      place(dotRef.current, e.clientX, e.clientY);   // no RAF: no lost frame
      wake();
    };

    const onDown = () => {
      outlineRef.current?.classList.add('cursor--active');
      dotRef.current?.classList.add('cursor--active');
    };
    const onUp = () => {
      outlineRef.current?.classList.remove('cursor--active');
      dotRef.current?.classList.remove('cursor--active');
    };

    // pointerover/out fire on every element boundary the pointer crosses, and
    // each one ran a closest() walk up the tree. Tracking whether the state
    // actually changed keeps the DOM write to the transitions that matter.
    const interactiveSel = 'a, button, [role="button"], input, textarea, label, select, summary';
    let overInteractive = false;
    const onOver = (e) => {
      const next = !!e.target.closest?.(interactiveSel);
      if (next === overInteractive) return;
      overInteractive = next;
      outlineRef.current?.classList.toggle('cursor--hover', next);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup',   onUp,   { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });

    document.documentElement.classList.add('has-custom-cursor');

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup',   onUp);
      document.removeEventListener('pointerover', onOver);
      cancelAnimationFrame(rafRef.current);
      running.current = false;
      document.documentElement.classList.remove('has-custom-cursor');
    };
  }, []);

  return (
    <>
      <div ref={outlineRef} className="custom-cursor custom-cursor--outline" aria-hidden="true" />
      <div ref={dotRef}     className="custom-cursor custom-cursor--dot"     aria-hidden="true" />
    </>
  );
}
