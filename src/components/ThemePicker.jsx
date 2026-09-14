import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'squad-split-theme';

export const THEMES = [
  {
    id: null,
    label: 'System',
    sub: 'Follows OS setting',
    dot: 'linear-gradient(135deg, #edf1ec 50%, #10160f 50%)',
  },
  {
    id: 'light',
    label: 'Default Light',
    sub: 'Green meadow',
    dot: 'linear-gradient(135deg, #e3e9e1 50%, #1e6b3d 50%)',
  },
  {
    id: 'dark',
    label: 'Default Dark',
    sub: 'Dark forest',
    dot: 'linear-gradient(135deg, #182019 50%, #49b074 50%)',
  },
  {
    id: 'fc24',
    label: 'EA FC24',
    sub: 'Neon night',
    dot: 'linear-gradient(135deg, #0D1117 50%, #00FF7F 50%)',
  },
  {
    id: 'wc2022',
    label: 'Qatar 2022',
    sub: 'Maroon & gold',
    dot: 'linear-gradient(135deg, #8B1535 50%, #C9A84C 50%)',
  },
  {
    id: 'wc2018',
    label: 'Russia 2018',
    sub: 'Red & blue',
    dot: 'linear-gradient(135deg, #CC0A2A 50%, #003087 50%)',
  },
  {
    id: 'wc2014',
    label: 'Brazil 2014',
    sub: 'Verde-Amarela',
    dot: 'linear-gradient(135deg, #009B3A 50%, #F5C800 50%)',
  },
  {
    id: 'wc2010',
    label: 'S. Africa 2010',
    sub: 'Ubuntu gold',
    dot: 'linear-gradient(135deg, #007749 50%, #FFB81C 50%)',
  },
];

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

function applyTheme(id) {
  if (id == null) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem(STORAGE_KEY);
  } else {
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem(STORAGE_KEY, id);
  }
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) ?? null);
  const ref = useRef(null);

  function pick(id) {
    setActive(id);
    applyTheme(id);
    setOpen(false);
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = THEMES.find((t) => t.id === active) ?? THEMES[0];

  return (
    <div ref={ref} className="theme-picker">
      <button
        className="btn ghost small theme-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change theme"
      >
        <span className="theme-dot-sm" style={{ background: current.dot }} />
        {current.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="theme-dropdown" role="listbox">
          {THEMES.map((t) => (
            <button
              key={String(t.id)}
              role="option"
              aria-selected={active === t.id}
              className={`theme-option${active === t.id ? ' active' : ''}`}
              onClick={() => pick(t.id)}
            >
              <span className="theme-dot-lg" style={{ background: t.dot }} />
              <span className="theme-option-text">
                <span className="theme-option-label">{t.label}</span>
                <span className="theme-option-sub">{t.sub}</span>
              </span>
              {active === t.id && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ marginLeft: 'auto', opacity: 0.7 }}>
                  <path d="M2 7l3.5 3.5L12 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
