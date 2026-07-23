/* WordAPA7 — Rules & Font Configurator with Profile Management */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { BulletStyle, NumberStyle } from '../../types';
import { NumberStylePicker } from '../shared/NumberStylePicker';
import { Type, AlignLeft, StretchHorizontal, Save, FolderOpen, RotateCcw, Plus } from 'lucide-react';

const FONT_OPTIONS = [
  { value: 'Times New Roman', label: 'Times New Roman', defaultSize: 12 },
  { value: 'Calibri', label: 'Calibri', defaultSize: 11 },
  { value: 'Arial', label: 'Arial', defaultSize: 11 },
  { value: 'Georgia', label: 'Georgia', defaultSize: 11 },
  { value: 'Lucida Sans Unicode', label: 'Lucida Sans Unicode', defaultSize: 10 },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

export const RulesView: React.FC = () => {
  const {
    rules,
    setRules,
    ruleProfiles,
    saveRuleProfile,
    loadRuleProfile,
    resetRulesToDefault,
  } = useDocStore();

  const [newProfileName, setNewProfileName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleSaveProfile = () => {
    if (newProfileName.trim()) {
      saveRuleProfile(newProfileName.trim());
      setNewProfileName('');
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="view-page">
      <div className="view-page-inner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 className="view-page-title" style={{ marginBottom: 0 }}>Tipografia y Formato APA 7</h2>

          {/* Profile Actions */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {ruleProfiles.length > 0 && (
              <select
                className="form-select"
                style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                value=""
                onChange={(e) => {
                  if (e.target.value) loadRuleProfile(e.target.value);
                }}
              >
                <option value="">Cargar perfil...</option>
                <option value="APA 7 Estándar">APA 7 Estandar (defecto)</option>
                {ruleProfiles
                  .filter((p) => p.profile_name !== 'APA 7 Estándar')
                  .map((p) => (
                    <option key={p.profile_name} value={p.profile_name}>
                      {p.profile_name}
                    </option>
                  ))}
              </select>
            )}
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowSaveDialog(true)}
              title="Guardar perfil actual"
            >
              <Save size={14} style={{ marginRight: '4px' }} />
              Guardar
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={resetRulesToDefault}
              title="Restaurar valores APA por defecto"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Active profile indicator */}
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'var(--accent-subtle)',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '12px',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <FolderOpen size={14} />
          Perfil activo: <strong>{rules.profile_name}</strong>
          {rules.is_default && ' (defecto APA 7)'}
        </div>

        {/* Save Profile Dialog (inline) */}
        {showSaveDialog && (
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--bg-layer)',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid var(--border-default)',
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Plus size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Nuevo perfil de reglas</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre del perfil (ej. Prof. Martinez 2024)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSaveProfile}>
                Guardar
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setShowSaveDialog(false); setNewProfileName(''); }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Font Family */}
        <div className="view-page-section">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Type size={14} />
              Fuente del Documento (Permitidas por APA 7)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-select"
                style={{ flex: 1 }}
                value={rules.font_family}
                onChange={(e) => {
                  const font = FONT_OPTIONS.find((f) => f.value === e.target.value);
                  setRules({
                    font_family: e.target.value,
                    font_size_pt: font?.defaultSize ?? rules.font_size_pt,
                  });
                }}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label} ({f.defaultSize} pt)
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                style={{ width: '90px' }}
                value={rules.font_size_pt}
                onChange={(e) => setRules({ font_size_pt: Number(e.target.value) })}
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Line Spacing */}
        <div className="view-page-section">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <StretchHorizontal size={14} />
              Interlineado
            </label>
            <select
              className="form-select"
              value={rules.line_spacing}
              onChange={(e) => setRules({ line_spacing: parseFloat(e.target.value) })}
            >
              <option value={2.0}>Doble 2.0 (Estandar APA 7)</option>
              <option value={1.5}>1.5 (Compacto)</option>
              <option value={1.0}>Sencillo 1.0</option>
            </select>
          </div>
        </div>

        {/* Alignment */}
        <div className="view-page-section">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlignLeft size={14} />
              Alineacion
            </label>
            <select
              className="form-select"
              value={rules.paragraph_indent_cm}
              onChange={(e) => setRules({ paragraph_indent_cm: parseFloat(e.target.value) })}
            >
              <option value={1.27}>Sangria 1.27 cm (Estandar APA 7)</option>
              <option value={0}>Sin sangria</option>
              <option value={1.5}>Sangria 1.5 cm</option>
            </select>
          </div>
        </div>

        {/* Bullet Style Picker — Level 1 */}
        <NumberStylePicker
          label="Estilo de Vinetas — Nivel 1"
          value={rules.bullet_style_level1 || 'disc'}
          onChange={(value) => setRules({ bullet_style_level1: value as BulletStyle })}
          mode="bullet"
        />

        {/* Bullet Style Picker — Level 2 */}
        <NumberStylePicker
          label="Estilo de Vinetas — Nivel 2"
          value={rules.bullet_style_level2 || 'circle'}
          onChange={(value) => setRules({ bullet_style_level2: value as BulletStyle })}
          mode="bullet"
        />

        {/* Number Style Picker — Level 1 */}
        <NumberStylePicker
          label="Estilo de Enumeracion — Nivel 1"
          value={rules.number_style_level1 || 'decimal'}
          onChange={(value) => setRules({ number_style_level1: value as NumberStyle })}
          mode="number"
        />

        {/* Number Style Picker — Level 2 */}
        <NumberStylePicker
          label="Estilo de Enumeracion — Nivel 2"
          value={rules.number_style_level2 || 'lowerLetter'}
          onChange={(value) => setRules({ number_style_level2: value as NumberStyle })}
          mode="number"
        />

        {/* APA Info Card */}
        <div className="card" style={{ marginTop: '8px', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Margenes fijados por APA 7:
          </div>
          <p className="text-xs text-tertiary">
            2.54 cm (1 pulgada) en los 4 costados (Superior, Inferior, Izquierdo, Derecho).
          </p>
        </div>
      </div>
    </div>
  );
};
