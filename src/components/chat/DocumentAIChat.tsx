import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Check,
  RotateCcw,
  Loader2,
  FileEdit,
  Quote,
  AlignLeft,
  BookOpen,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { sendLiveChat, LiveChatAction } from '../../api/backend';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: LiveChatAction[];
  applied?: boolean;
}

export const DocumentAIChat: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '¡Hola! Soy tu Copiloto APA 7. Puedo reescribir párrafos en tono académico, estructurar citas en bloque, agregar citas en el texto, sugerir títulos para tus tablas o responder dudas de formato. ¿En qué te ayudo hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const doc = useDocStore((s) => s.doc);
  const selectedElementId = useDocStore((s) => s.selectedElementId);
  const updateElementText = useDocStore((s) => s.updateElementText);
  const updateElementType = useDocStore((s) => s.updateElementType);
  const addReferencia = useDocStore((s) => s.addReferencia);
  const showToast = useDocStore((s) => s.showToast);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const selectedElement = doc?.elements.find((e) => e.id === selectedElementId);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || !doc || isSending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendLiveChat(doc.session_id, textToSend, selectedElementId, history);

      const botMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: res.reply,
        actions: res.actions,
      };

      setMessages((prev) => [...prev, botMsg]);

      // Si vienen acciones, aplicarlas automáticamente con feedback
      if (res.actions && res.actions.length > 0) {
        applyActions(res.actions);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          content: `No se pudo procesar la solicitud: ${err.message || 'Error de conexión con la IA'}.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const applyActions = (actions: LiveChatAction[]) => {
    let appliedCount = 0;
    actions.forEach((act) => {
      if (act.type === 'update_text' && act.element_id && act.text) {
        updateElementText(act.element_id, act.text);
        appliedCount++;
      } else if (act.type === 'set_type' && act.element_id && act.element_type) {
        updateElementType(act.element_id, act.element_type as any, act.level || 1);
        appliedCount++;
      } else if (act.type === 'insert_citation' && act.element_id && act.citation) {
        const target = doc?.elements.find((e) => e.id === act.element_id);
        if (target) {
          const current = (target.text || '').trim();
          updateElementText(act.element_id, `${current} ${act.citation}`);
          appliedCount++;
        }
      } else if (act.type === 'add_reference' && act.reference) {
        addReferencia({
          id: `ref-ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          raw_text: act.reference,
          authors: [],
          year: '',
          title: act.reference,
          source: '',
          doi_or_url: '',
          formatted_apa: act.reference,
        });
        appliedCount++;
      }

    });

    if (appliedCount > 0) {
      showToast(`${appliedCount} ${appliedCount === 1 ? 'cambio aplicado' : 'cambios aplicados'} en vivo`, 'success');
    }
  };

  const quickPrompts = [
    { label: 'Mejorar tono académico APA', prompt: 'Reescribe este párrafo en estilo formal académico según APA 7, eliminando lenguaje informal o muletillas.' },
    { label: 'Cita en bloque (>40 palabras)', prompt: 'Convierte este texto a formato de cita en bloque APA 7 (más de 40 palabras).' },
    { label: 'Detectar citas faltantes', prompt: 'Analiza este párrafo e indícame si hay afirmaciones empíricas que requieran respaldo de una cita APA.' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--sidebar-bg, #ffffff)',
        borderLeft: '1px solid var(--border-subtle, #e5e7eb)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
          backgroundColor: 'var(--surface-elevated, #ffffff)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-accent-soft, rgba(79, 124, 255, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #4f7cff)',
            }}
          >
            <Bot size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main, #1a1a2e)' }}>
              Copiloto Editorial APA 7
            </div>
            <div style={{ fontSize: '10px', color: 'var(--accent-success, #10b981)', fontWeight: 600 }}>
              Edición en vivo activa
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #6b7280)',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Context Banner */}
      {selectedElement && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--color-accent-soft, rgba(79, 124, 255, 0.08))',
            borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
            fontSize: '11px',
            color: 'var(--accent-primary, #4f7cff)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <Info size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Contexto: <strong>{selectedElement.type}</strong> ({selectedElement.text?.slice(0, 35)}...)
          </span>
        </div>
      )}

      {/* Message List */}
      <div
        style={{
          flex: 1,
          padding: '14px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: m.role === 'user' ? 'var(--accent-primary, #4f7cff)' : 'var(--surface-subtle, #f3f4f6)',
                  color: m.role === 'user' ? '#ffffff' : 'var(--text-secondary, #6b7280)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '11px',
                }}
              >
                {m.role === 'user' ? <User size={13} /> : <Bot size={13} />}
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: m.role === 'user' ? 'var(--accent-primary, #4f7cff)' : 'var(--surface-elevated, #ffffff)',
                  color: m.role === 'user' ? '#ffffff' : 'var(--text-main, #1a1a2e)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle, #e5e7eb)',
                  boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                  fontSize: '12px',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.content}

                {/* Acciones aplicadas */}
                {m.actions && m.actions.length > 0 && (
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(0,0,0,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-success, #10b981)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Cambios aplicados al documento:
                    </div>
                    {m.actions.map((act, idx) => (
                      <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)', fontStyle: 'italic' }}>
                        • {act.type === 'update_text' ? 'Texto actualizado' : act.type === 'set_type' ? `Convertido a ${act.element_type}` : act.type}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isSending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary, #6b7280)', fontSize: '12px', padding: '6px' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Analizando y aplicando edición en vivo...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div
        style={{
          padding: '6px 12px',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          borderTop: '1px solid var(--border-subtle, #e5e7eb)',
          backgroundColor: 'var(--surface-subtle, #f9fafb)',
          flexShrink: 0,
        }}
      >
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(qp.prompt)}
            disabled={isSending}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'var(--surface-elevated, #ffffff)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
              borderRadius: '999px',
              color: 'var(--text-secondary, #4b5563)',
              cursor: isSending ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-subtle, #e5e7eb)',
          backgroundColor: 'var(--surface-elevated, #ffffff)',
          display: 'flex',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={selectedElement ? 'Pide un cambio sobre el texto seleccionado...' : 'Escribe una instrucción para la IA...'}
          disabled={isSending}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle, #e5e7eb)',
            fontSize: '12px',
            outline: 'none',
            fontFamily: 'inherit',
            backgroundColor: 'var(--app-bg, #f8f9fa)',
            color: 'var(--text-main, #1a1a2e)',
          }}
        />

        <button
          type="submit"
          disabled={!input.trim() || isSending}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'var(--accent-primary, #4f7cff)',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: !input.trim() || isSending ? 'not-allowed' : 'pointer',
            opacity: !input.trim() || isSending ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
