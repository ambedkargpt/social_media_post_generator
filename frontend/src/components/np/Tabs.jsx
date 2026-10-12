import { useRef } from 'react';
import Segmented from './Segmented';

/**
 * Tabs look exactly like Segmented and differ only in semantics and
 * keyboard handling: arrows move between tabs, Home and End jump to the
 * ends, and the roles say "tablist" so a screen reader announces position.
 *
 * Shared rather than copied, because two controls that look identical and
 * drift apart is worse than one that carries a flag.
 */
export default function Tabs({ options, value, onChange, ariaLabel, ...rest }) {
  const ref = useRef(null);

  const onKeyDown = (e) => {
    const i = options.findIndex((o) => o.value === value);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
  };

  return (
    <div ref={ref} onKeyDown={onKeyDown}>
      <Segmented options={options} value={value} onChange={onChange} ariaLabel={ariaLabel} {...rest} />
    </div>
  );
}
