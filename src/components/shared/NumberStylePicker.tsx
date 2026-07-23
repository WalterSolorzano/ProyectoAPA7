/* WordAPA7 — Visual Number Style Picker */

import React from 'react';
import { NumberStyle, BulletStyle } from '../../types';
import { Hash, ALargeSmall, Pilcrow, Circle, Square, Minus } from 'lucide-react';

interface NumberStylePickerProps {
  label: string;
  value: NumberStyle | BulletStyle;
  onChange: (value: NumberStyle | BulletStyle) => void;
  mode: 'number' | 'bullet';
}

interface StyleCardDef {
  id: string;
  label: string;
  preview: string[];
  icon: React.ReactNode;
}

const NUMBER_STYLES: StyleCardDef[] = [
  {
    id: 'decimal',
    label: 'Arabigos',
    preview: ['1. Primer elemento', '2. Segundo elemento', '3. Tercer elemento'],
    icon: <Hash size={16} />,
  },
  {
    id: 'lowerLetter',
    label: 'Min. letra',
    preview: ['a. Primer elemento', 'b. Segundo elemento', 'c. Tercer elemento'],
    icon: <ALargeSmall size={16} />,
  },
  {
    id: 'upperLetter',
    label: 'May. letra',
    preview: ['A. Primer elemento', 'B. Segundo elemento', 'C. Tercer elemento'],
    icon: <ALargeSmall size={16} />,
  },
  {
    id: 'lowerRoman',
    label: 'Rom. min.',
    preview: ['i. Primer elemento', 'ii. Segundo elemento', 'iii. Tercer elemento'],
    icon: <Pilcrow size={16} />,
  },
  {
    id: 'upperRoman',
    label: 'Rom. may.',
    preview: ['I. Primer elemento', 'II. Segundo elemento', 'III. Tercer elemento'],
    icon: <Pilcrow size={16} />,
  },
];

const BULLET_STYLES: StyleCardDef[] = [
  {
    id: 'disc',
    label: 'Disco',
    preview: ['•  Primer elemento', '•  Segundo elemento', '•  Tercer elemento'],
    icon: <Circle size={16} fill="currentColor" />,
  },
  {
    id: 'dash',
    label: 'Guion',
    preview: ['–  Primer elemento', '–  Segundo elemento', '–  Tercer elemento'],
    icon: <Minus size={16} />,
  },
  {
    id: 'circle',
    label: 'Circulo',
    preview: ['○  Primer elemento', '○  Segundo elemento', '○  Tercer elemento'],
    icon: <Circle size={16} />,
  },
  {
    id: 'square',
    label: 'Cuadrado',
    preview: ['▪  Primer elemento', '▪  Segundo elemento', '▪  Tercer elemento'],
    icon: <Square size={16} fill="currentColor" />,
  },
];

export const NumberStylePicker: React.FC<NumberStylePickerProps> = ({
  label,
  value,
  onChange,
  mode,
}) => {
  const styles = mode === 'number' ? NUMBER_STYLES : BULLET_STYLES;

  return (
    <div className="form-group">
      <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', display: 'block' }}>
        {label}
      </label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '10px',
      }}>
        {styles.map((style) => {
          const isSelected = value === style.id;
          return (
            <div
              key={style.id}
              onClick={() => onChange(style.id as NumberStyle | BulletStyle)}
              style={{
                padding: '14px',
                borderRadius: '8px',
                border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-default)'}`,
                backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-base)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-layer)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                }}>
                  {style.icon}
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {style.label}
                </span>
              </div>
              <div style={{
                padding: '8px 10px',
                backgroundColor: 'var(--bg-layer)',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-ui)',
                color: 'var(--text-tertiary)',
                lineHeight: 1.7,
              }}>
                {style.preview.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NumberStylePicker;
