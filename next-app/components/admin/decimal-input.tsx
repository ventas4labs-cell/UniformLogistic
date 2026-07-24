'use client';

import { useState } from 'react';

// Free-form decimal input that accepts both "." and "," as the decimal
// separator. Browsers' native type="number" silently rejects "," in
// many locales (en-US in particular), which made it impossible to enter
// values like 0,1 even though the rest of the UI is Spanish. Holds the
// raw typed string locally so partial input like "0," renders while the
// user is mid-type, and only flushes back a parsed number to the parent.
//
// Shared by the product BOM editor and the corte fabric report — both
// take quantities operators write with a comma.
export function DecimalInput({
    value,
    onChange,
    className,
    placeholder,
    ariaLabel
}: {
    value: number;
    onChange: (next: number) => void;
    className?: string;
    placeholder?: string;
    ariaLabel?: string;
}) {
    const [text, setText] = useState(() =>
        Number.isFinite(value) && value > 0 ? String(value) : ''
    );
    const [focused, setFocused] = useState(false);
    const [lastValue, setLastValue] = useState(value);

    // Re-sync when the parent value changes externally (e.g. form reset
    // or another row editing the same row's qty). Done during render —
    // React's "adjusting state when a prop changes" pattern — rather
    // than in an effect, which would cost an extra render pass.
    //
    // Skip if the locally typed text already represents the same number:
    // that means the change came from this input itself (a "0,5" → 0.5
    // round-trip) and we don't want to clobber the user's literal "0,5"
    // with "0.5". Also skip while focused, as a belt-and-suspenders
    // guard for mid-typing states like "0," where the parsed value is 0.
    if (value !== lastValue) {
        setLastValue(value);
        const parsed = parseFloat(text.replace(',', '.'));
        if (!focused && !(Number.isFinite(parsed) && parsed === value)) {
            setText(Number.isFinite(value) && value > 0 ? String(value) : '');
        }
    }

    return (
        <input
            type="text"
            inputMode="decimal"
            value={text}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onFocus={() => setFocused(true)}
            onBlur={() => {
                setFocused(false);
                const normalized = text.replace(',', '.');
                const n = parseFloat(normalized);
                if (Number.isFinite(n) && n >= 0) {
                    setText(String(n));
                    onChange(n);
                } else {
                    setText('');
                    onChange(0);
                }
            }}
            onChange={(e) => {
                const raw = e.target.value;
                // Allow only digits and a single separator.
                if (!/^\d*[.,]?\d*$/.test(raw)) return;
                setText(raw);
                if (raw === '' || raw === '.' || raw === ',') {
                    onChange(0);
                    return;
                }
                const n = parseFloat(raw.replace(',', '.'));
                if (Number.isFinite(n) && n >= 0) onChange(n);
            }}
            className={className}
        />
    );
}
