import React, { useEffect, useRef, useState } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  compact?: boolean;
}

const formatRupiahNumberPart = (num: number): string => {
  if (!Number.isFinite(num) || num === 0) return '0';
  const rounded = Math.round(num * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.0001;
  const [intRaw, decRaw] = hasDecimals
    ? rounded.toFixed(2).split('.')
    : [String(Math.round(rounded)), ''];

  const formattedInt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (hasDecimals && decRaw) {
    const trimmedDec = decRaw.replace(/0+$/, '');
    return trimmedDec ? `${formattedInt},${trimmedDec}` : formattedInt;
  }
  return formattedInt;
};

const parseAndFormatRaw = (raw: string): { display: string; numeric: number } => {
  // Keep only digits and first comma (Indonesian decimal separator)
  let cleaned = '';
  let seenComma = false;

  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      cleaned += ch;
    } else if (ch === ',' && !seenComma) {
      cleaned += ',';
      seenComma = true;
    }
  }

  if (!cleaned) {
    return { display: '', numeric: 0 };
  }

  const commaIdx = cleaned.indexOf(',');
  if (commaIdx === -1) {
    const normalizedInt = cleaned.replace(/^0+(?=\d)/, '');
    const formattedInt = normalizedInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return {
      display: formattedInt,
      numeric: Number(normalizedInt || '0'),
    };
  }

  const rawInt = cleaned.slice(0, commaIdx);
  const rawDec = cleaned.slice(commaIdx + 1).slice(0, 2);
  const normalizedInt = rawInt ? rawInt.replace(/^0+(?=\d)/, '') : '0';
  const formattedInt = normalizedInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const display = `${formattedInt},${rawDec}`;
  const numeric = Number(`${normalizedInt || '0'}.${rawDec || '0'}`);

  return {
    display,
    numeric: Number.isFinite(numeric) ? numeric : 0,
  };
};

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0',
  required = false,
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [displayText, setDisplayText] = useState(() =>
    formatRupiahNumberPart(value)
  );

  // Sync external value changes when not actively typing an incomplete state (e.g. "1.500," or "")
  useEffect(() => {
    if (!isFocused) {
      setDisplayText(formatRupiahNumberPart(value));
      return;
    }
    const currentParsed = parseAndFormatRaw(displayText).numeric;
    if (Math.abs(currentParsed - value) > 0.001) {
      setDisplayText(formatRupiahNumberPart(value));
    }
  }, [value, isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const caretBefore = e.target.selectionStart ?? raw.length;

    // Count meaningful chars (digits + comma) before caret so cursor stays steady after dot insertion
    let meaningfulBefore = 0;
    for (let i = 0; i < caretBefore; i++) {
      const ch = raw[i];
      if ((ch >= '0' && ch <= '9') || ch === ',') {
        meaningfulBefore++;
      }
    }

    const { display, numeric } = parseAndFormatRaw(raw);
    setDisplayText(display);
    onChange(numeric);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el || document.activeElement !== el) return;
      let targetPos = 0;
      let seen = 0;
      while (targetPos < display.length && seen < meaningfulBefore) {
        const ch = display[targetPos];
        if ((ch >= '0' && ch <= '9') || ch === ',') {
          seen++;
        }
        targetPos++;
      }
      el.setSelectionRange(targetPos, targetPos);
    });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value === 0) {
      e.target.select();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setDisplayText(formatRupiahNumberPart(value));
  };

  return (
    <div className="relative flex items-center w-full">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 flex items-center font-mono-num font-medium text-slate-500 dark:text-slate-400 select-none ${
          compact ? 'pl-2.5 text-xs' : 'pl-3 text-xs sm:text-sm'
        }`}
      >
        Rp
      </span>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={displayText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`${className} ${compact ? 'pl-8' : 'pl-9'}`}
      />
    </div>
  );
};
