import { useId } from 'react';

/**
 * Form controls.
 *
 * One module rather than four files because the label, the control and the
 * error message have to agree on ids, sizes and border states, and splitting
 * them up only means exporting the shared pieces anyway.
 *
 * The control is 52px tall and 17px - larger than the old 44px/15px - because
 * the floor is a phone, and because Devanagari at 15px reads smaller than
 * Latin at 15px even before the eye is tired.
 */

const CONTROL = {
  width: '100%',
  minHeight: 52,
  padding: '0 14px',
  background: 'var(--color-np-desk)',
  border: '1px solid var(--color-np-track)',
  borderRadius: 10,
  color: 'var(--color-np-text)',
  fontSize: 17,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color var(--np-dur-1) var(--np-ease-out)',
};

export function Field({ label, hint, error, children, htmlFor, counter }) {
  return (
    <div className="np-field" style={{ display: 'grid', gap: 8 }}>
      {label && (
        <label
          htmlFor={htmlFor}
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-np-text-2)' }}
        >
          {label}
        </label>
      )}
      {children}
      {/* The error replaces the hint rather than stacking under it: two lines
          of guidance under one field is how a form starts to look anxious. */}
      {(error || hint || counter) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{
            fontSize: 14,
            color: error ? 'var(--color-np-critical)' : 'var(--color-np-muted)',
          }}>
            {error || hint}
          </span>
          {counter && (
            <span className="np-mono" style={{ fontSize: 12, color: 'var(--color-np-faint)' }}>
              {counter}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * `prefix` is the slot for a fixed part of the value - +91, @ - that the user
 * must not have to type and must not be able to delete.
 */
export function Input({ error, prefix, id, style, ...rest }) {
  const auto = useId();
  const inputId = id || auto;
  const describedBy = error ? `${inputId}-err` : undefined;

  const control = (
    <input
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className="np-control"
      style={{
        ...CONTROL,
        borderColor: error ? 'var(--color-np-critical)' : CONTROL.border,
        ...(prefix ? { border: 'none', background: 'transparent', minHeight: 50 } : null),
        ...style,
      }}
      {...rest}
    />
  );

  if (!prefix) return control;

  return (
    <div
      className="np-control np-control-group"
      style={{
        ...CONTROL,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        borderColor: error ? 'var(--color-np-critical)' : undefined,
      }}
    >
      <span style={{
        padding: '0 12px',
        color: 'var(--color-np-muted)',
        borderRight: '1px solid var(--color-np-track)',
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        fontSize: 16,
      }}>
        {prefix}
      </span>
      {control}
    </div>
  );
}

export function Textarea({ error, id, rows = 5, style, ...rest }) {
  const auto = useId();
  const taId = id || auto;
  return (
    <textarea
      id={taId}
      rows={rows}
      aria-invalid={error ? true : undefined}
      className="np-control"
      style={{
        ...CONTROL,
        padding: '14px',
        lineHeight: 1.6,
        resize: 'vertical',
        borderColor: error ? 'var(--color-np-critical)' : undefined,
        ...style,
      }}
      {...rest}
    />
  );
}

export function Select({ error, id, children, style, ...rest }) {
  const auto = useId();
  const selId = id || auto;
  return (
    <select
      id={selId}
      aria-invalid={error ? true : undefined}
      className="np-control"
      style={{
        ...CONTROL,
        // The native arrow is drawn by the OS and ignores colour, so it is
        // replaced rather than fought with.
        appearance: 'none',
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%23A6ABBA' stroke-width='2'><path d='M5 8l5 5 5-5'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: 40,
        borderColor: error ? 'var(--color-np-critical)' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export default Field;
