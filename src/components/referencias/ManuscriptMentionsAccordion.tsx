import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Copy,
  FileText,
} from 'lucide-react';

export interface ManuscriptCitationMention {
  page: number;
  p: string;
  text: string;
  highlight?: string;
}

export interface ManuscriptMentionsAccordionProps {
  citations: ManuscriptCitationMention[];
  onJumpToWord?: (page: number, p: string) => void;
  onCopyCitation?: () => void;
  defaultOpen?: boolean;
  className?: string;
}

function parseTextSegments(rawText: string, customHighlight?: string): { isHighlight: boolean; text: string }[] {
  if (!rawText) return [];

  // 1. If rawText already has HTML span markup
  if (/<span\b[^>]*>/i.test(rawText)) {
    const parts: { isHighlight: boolean; text: string }[] = [];
    const spanRegex = /<span\b[^>]*>([\s\S]*?)<\/span>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = spanRegex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ isHighlight: false, text: rawText.substring(lastIndex, match.index) });
      }
      parts.push({ isHighlight: true, text: match[1] });
      lastIndex = spanRegex.lastIndex;
    }
    if (lastIndex < rawText.length) {
      parts.push({ isHighlight: false, text: rawText.substring(lastIndex) });
    }
    return parts;
  }

  // 2. If customHighlight passed
  if (customHighlight && rawText.includes(customHighlight)) {
    const parts: { isHighlight: boolean; text: string }[] = [];
    const pieces = rawText.split(customHighlight);
    pieces.forEach((p, idx) => {
      if (idx > 0) parts.push({ isHighlight: true, text: customHighlight });
      if (p) parts.push({ isHighlight: false, text: p });
    });
    return parts;
  }

  // 3. Fallback: match parenthetical and narrative APA 7 citations
  const CITATION_REGEX = /(\([A-ZÁÉÍÓÚÑ][^)]*\d{4}[a-z]?(?:,\s*p[p]?\.\s*\d+)?\s*\)|[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ\s&y\.,\-]+?(?:\s+et\s+al\.?)?\s*\(\d{4}[a-z]?(?:,\s*p[p]?\.\s*\d+)?\))/g;
  const parts: { isHighlight: boolean; text: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CITATION_REGEX.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ isHighlight: false, text: rawText.substring(lastIndex, match.index) });
    }
    parts.push({ isHighlight: true, text: match[0] });
    lastIndex = CITATION_REGEX.lastIndex;
  }
  if (lastIndex < rawText.length) {
    parts.push({ isHighlight: false, text: rawText.substring(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ isHighlight: false, text: rawText }];
}

export const ManuscriptMentionsAccordion: React.FC<ManuscriptMentionsAccordionProps> = ({
  citations,
  onJumpToWord,
  onCopyCitation,
  defaultOpen = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const countBadgeText =
    citations.length === 0
      ? '0 citas'
      : citations.length === 1
      ? '1 cita registrada'
      : `${citations.length} citas registradas`;

  return (
    <div
      className={`manuscript-mentions-accordion ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* Collapsible Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: 'var(--color-bg-surface, #ffffff)',
          border: '1px solid var(--color-border-subtle, #e2e8f0)',
          borderRadius: 'var(--radius-md, 8px)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={18} strokeWidth={2} color="var(--primary, #4361ee)" />
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm, 14px)',
                fontWeight: 700,
                color: 'var(--paper-ink, #1e293b)',
                letterSpacing: '-0.01em',
              }}
            >
              Aparición en el Manuscrito
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs, 12px)',
                color: 'var(--color-text-secondary, #64748b)',
              }}
            >
              Ver los párrafos donde se cita esta obra
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--radius-full, 9999px)',
              backgroundColor: 'var(--primary-soft, #eef2ff)',
              color: 'var(--primary, #4361ee)',
            }}
          >
            {countBadgeText}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--color-text-secondary, #64748b)',
            }}
          >
            {isOpen ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
          </span>
        </div>
      </button>

      {/* Accordion Body */}
      {isOpen && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {citations.length === 0 ? (
            /* Orphan state fallback */
            <div
              data-testid="orphan-mentions-card"
              style={{
                padding: '24px',
                borderRadius: 'var(--radius-lg, 12px)',
                backgroundColor: 'var(--color-bg-surface, #ffffff)',
                border: '1px solid var(--color-border-subtle, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  padding: '10px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  backgroundColor: 'var(--severity-warning-soft, #fef3c7)',
                  color: 'var(--color-warning, #d97706)',
                }}
              >
                <AlertTriangle size={24} strokeWidth={2} />
              </div>
              <div
                style={{
                  fontSize: 'var(--text-base, 15px)',
                  fontWeight: 700,
                  color: 'var(--color-text-primary, #1e293b)',
                }}
              >
                Esta obra no está citada en el cuerpo del trabajo
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--text-sm, 13px)',
                  lineHeight: 1.5,
                  color: 'var(--color-text-secondary, #64748b)',
                  maxWidth: '480px',
                }}
              >
                Aparece en la bibliografía final pero ningún párrafo de la tesis o artículo hace referencia a ella. En APA 7, las fuentes no citadas deben removerse o insertarse debidamente en el texto.
              </p>
              <button
                type="button"
                onClick={onCopyCitation}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '4px',
                  padding: '7px 14px',
                  fontSize: 'var(--text-xs, 12px)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary, #1e293b)',
                  backgroundColor: 'var(--paper-white, #ffffff)',
                  border: '1px solid var(--color-border-subtle, #cbd5e1)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Copy size={13} strokeWidth={2} />
                <span>Copiar cita para insertar en un párrafo</span>
              </button>
            </div>
          ) : (
            /* Citation cards */
            citations.map((c, idx) => {
              const segments = parseTextSegments(c.text, c.highlight);

              return (
                <div
                  key={idx}
                  className="mention-quote-card"
                  style={{
                    backgroundColor: 'var(--paper-white, #ffffff)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    border: '1px solid var(--color-border-subtle, #e2e8f0)',
                    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
                    padding: '20px 24px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Badge bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--canvas-bg, #f1f5f9)',
                      paddingBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--primary, #4361ee)',
                        backgroundColor: 'var(--primary-soft, #eef2ff)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <FileText size={12} strokeWidth={2.5} />
                      Página {c.page} • {c.p}
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--status-verified, #16a34a)',
                      }}
                    >
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                      <span>Concordancia APA Confirmada</span>
                    </span>
                  </div>

                  {/* Editorial Quote Container */}
                  <div
                    style={{
                      position: 'relative',
                      paddingLeft: '28px',
                      margin: '6px 0',
                    }}
                  >
                    <span
                      data-testid="quote-mark"
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '-8px',
                        top: '-24px',
                        fontFamily: "'Newsreader', 'Georgia', serif",
                        fontSize: '72px',
                        lineHeight: 1,
                        color: 'rgba(67, 97, 238, 0.20)',
                        userSelect: 'none',
                        pointerEvents: 'none',
                      }}
                    >
                      “
                    </span>

                    <div
                      style={{
                        fontFamily: "'Newsreader', 'Georgia', serif",
                        fontSize: '17px',
                        lineHeight: 1.65,
                        color: 'var(--paper-ink, #1e293b)',
                        fontStyle: 'italic',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {segments.map((seg, sIdx) =>
                        seg.isHighlight ? (
                          <mark
                            key={sIdx}
                            data-testid="citation-highlight"
                            style={{
                              backgroundColor: 'var(--color-info-soft, #dbeafe)',
                              color: 'var(--color-info, #1e40af)',
                              borderBottom: '2px solid var(--color-info-border, #3b82f6)',
                              padding: '1px 4px',
                              borderRadius: 'var(--radius-xs, 3px)',
                              fontWeight: 600,
                              fontStyle: 'normal',
                            }}
                          >
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={sIdx}>{seg.text}</span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Quote footer */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--color-text-secondary, #64748b)',
                      }}
                    >
                      Ubicación exacta en el documento Word
                    </span>

                    <button
                      type="button"
                      onClick={() => onJumpToWord?.(c.page, c.p)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        fontSize: 'var(--text-xs, 12px)',
                        fontWeight: 600,
                        color: 'var(--primary, #4361ee)',
                        backgroundColor: 'var(--primary-soft, #eef2ff)',
                        border: '1px solid var(--color-border-subtle, #e2e8f0)',
                        borderRadius: 'var(--radius-sm, 6px)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>Saltar al párrafo en Word</span>
                      <ArrowRight size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
