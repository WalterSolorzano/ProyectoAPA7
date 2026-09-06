import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Sparkles, Bot, User, Check, RotateCcw, Loader2, FileEdit,
  Quote, AlignLeft, BookOpen, X, ChevronRight, Info, Zap, AlertCircle, WifiOff
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { sendLiveChat, LiveChatAction } from '../../api/backend';

interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string;
  actions?: LiveChatAction[]; applied?: boolean; isError?: boolean;
}

type QuickAction = { icon: React.ElementType; label: string; sublabel: string; prompt: string; color: string; };

const QUICK_ACTIONS: QuickAction[] = [
  { icon: FileEdit, label: 'Mejorar tono', sublabel: 'Reescribir en estilo académico formal', prompt: 'Reescribe el párrafo seleccionado en tono académico formal según APA 7, eliminando lenguaje informal.', color: 'var(--accent-primary, #4f7cff)' },
  { icon: Quote, label: 'Cita en bloque', sublabel: 'Formato APA para +40 palabras', prompt: 'Convierte el texto seleccionado a formato de cita en bloque APA 7 (más de 40 palabras, sangría de 1.27 cm).', color: 'var(--accent-success, #10b981)' },
  { icon: BookOpen, label: 'Revisar referencias', sublabel: 'Detectar citas sin respaldo', prompt: 'Analiza el documento y señala qué afirmaciones empíricas carecen de cita APA 7 como respaldo.', color: 'var(--accent-warning, #f59e0b)' },
];

function buildProactiveGreeting(doc: any): string {
  if (!doc) return 'Documento cargado. Puedo reescribir párrafos, estructurar citas, organizar referencias y corregir jerarquía de títulos. Elige una acción rápida o escribe una instrucción.';
  const elems = doc.elements || [];
  const totalParas = elems.filter((e: any) => e.type === 'paragraph').length;
  const totalHeadings = elems.filter((e: any) => e.type === 'heading').length;
  const totalRefs = doc.referencias?.length || 0;
  const totalTables = elems.filter((e: any) => e.type === 'table').length;
  const totalImages = elems.filter((e: any) => e.type === 'image').length;

  const parts: string[] = [];
  parts.push(`Analicé el documento: ${totalParas} párrafos, ${totalHeadings} títulos${totalRefs > 0 ? `, ${totalRefs} referencias` : ''}${totalTables > 0 ? `, ${totalTables} tablas` : ''}${totalImages > 0 ? `, ${totalImages} figuras` : ''}.`);

  if (totalRefs === 0 && totalParas > 3) parts.push('No encontré referencias — ¿hay citas en el cuerpo sin lista al final?');
  else if (totalHeadings === 0 && totalParas > 5) parts.push('No hay títulos formales — puedo ayudarte a estructurar la jerarquía H1/H2/H3.');
  else if (totalHeadings > 0 && totalRefs > 0) parts.push('El documento tiene estructura y referencias. Puedo revisar tono, citas o jerarquía de títulos.');

  parts.push('Elige una acción o escribe una instrucción.');
  return parts.join(' ');
}

export const DocumentAIChat: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const doc = useDocStore((s) => s.doc);
  const selectedElementId = useDocStore((s) => s.selectedElementId);
  const updateElementText = useDocStore((s) => s.updateElementText);
  const updateElementType = useDocStore((s) => s.updateElementType);
  const addReferencia = useDocStore((s) => s.addReferencia);
  const showToast = useDocStore((s) => s.showToast);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ id: 'welcome', role: 'assistant', content: buildProactiveGreeting(doc) }]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prevDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    const docId = (doc as any)?.session_id || null;
    if (docId && docId !== prevDocIdRef.current) {
      prevDocIdRef.current = docId;
      setMessages([{ id: `welcome-${docId}`, role: 'assistant', content: buildProactiveGreeting(doc) }]);
    }
  }, [doc]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isSending]);

  const selectedElement = doc?.elements.find((e) => e.id === selectedElementId);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || !doc || isSending) return;

    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendLiveChat(doc.session_id, textToSend, selectedElementId, history);
      const botMsg: ChatMessage = { id: `msg-${Date.now() + 1}`, role: 'assistant', content: res.reply, actions: res.actions };
      setMessages((prev) => [...prev, botMsg]);
      if (res.actions && res.actions.length > 0) applyActions(res.actions);
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed');
      setMessages((prev) => [...prev, { id: `msg-err-${Date.now()}`, role: 'assistant', content: isNetworkError ? 'Sin conexión con el motor de IA. Verifica que el backend esté activo (Estado del backend en Configuraciones).' : `No se pudo procesar: ${err.message || 'Error de IA'}.`, isError: true }]);
    } finally { setIsSending(false); }
  };

  const applyActions = (actions: LiveChatAction[]) => {
    let appliedCount = 0;
    actions.forEach((act) => {
      if (act.type === 'update_text' && act.element_id && act.text) { updateElementText(act.element_id, act.text); appliedCount++; }
      else if (act.type === 'set_type' && act.element_id && act.element_type) { updateElementType(act.element_id, act.element_type as any, act.level || 1); appliedCount++; }
      else if (act.type === 'insert_citation' && act.element_id && act.citation) {
        const target = doc?.elements.find((e) => e.id === act.element_id);
        if (target) { updateElementText(act.element_id, `${(target.text || '').trim()} ${act.citation}`); appliedCount++; }
      } else if (act.type === 'add_reference' && act.reference) {
        addReferencia({ id: `ref-ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, raw_text: act.reference, authors: [], year: '', title: act.reference, source: '', doi_or_url: '', formatted_apa: act.reference });
        appliedCount++;
      }
    });
    if (appliedCount > 0) showToast(`${appliedCount} ${appliedCount === 1 ? 'cambio aplicado' : 'cambios aplicados'} en vivo`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--sidebar-bg, #ffffff)', borderLeft: '1px solid var(--border-subtle, #e5e7eb)', fontFamily: 'var(--font-sans, system-ui, sans-serif)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle, #e5e7eb)', background: 'linear-gradient(135deg, var(--surface-elevated, #ffffff) 0%, rgba(79,124,255,0.04) 100%)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent-primary, #4f7cff) 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 2px 8px rgba(79,124,255,0.35)' }}><Sparkles size={15} /></div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main, #1a1a2e)', letterSpacing: '-0.01em' }}>Copiloto Editorial</div>
            <div style={{ fontSize: '10px', color: 'var(--accent-success, #10b981)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-success, #10b981)', display: 'inline-block', animation: 'pulse-dot 2s ease infinite' }} />Activo — edición en vivo</div>
          </div>
        </div>
        {onClose && (<button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #6b7280)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>)}
      </div>

      {selectedElement && (
        <div style={{ padding: '7px 12px', backgroundColor: 'rgba(79, 124, 255, 0.08)', borderBottom: '1px solid var(--border-subtle, #e5e7eb)', fontSize: '11px', color: 'var(--accent-primary, #4f7cff)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <Info size={12} style={{ flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Elemento activo: <strong>{selectedElement.type}</strong>{selectedElement.text ? ` — ${selectedElement.text.slice(0, 40)}...` : ''}</span>
        </div>
      )}

      <div style={{ flex: 1, padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((m) => (
          <div key={m.id} className="chat-msg-in" style={{ display: 'flex', flexDirection: 'column', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: m.role === 'user' ? 'var(--accent-primary, #4f7cff)' : m.isError ? 'var(--color-danger, #ef4444)' : 'linear-gradient(135deg, var(--accent-primary, #4f7cff) 0%, #7c3aed 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {m.role === 'user' ? <User size={12} /> : m.isError ? <AlertCircle size={12} /> : <Sparkles size={12} />}
              </div>
              <div style={{ padding: '9px 12px', borderRadius: m.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px', backgroundColor: m.role === 'user' ? 'var(--accent-primary, #4f7cff)' : m.isError ? 'rgba(239,68,68,0.08)' : 'var(--surface-elevated, #ffffff)', color: m.role === 'user' ? '#ffffff' : m.isError ? 'var(--color-danger, #ef4444)' : 'var(--text-main, #1a1a2e)', border: m.role === 'user' ? 'none' : m.isError ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border-subtle, #e5e7eb)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {m.isError && (<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: 700, fontSize: '11px' }}><WifiOff size={12} />Error de conexión</div>)}
                {m.content}
                {m.actions && m.actions.length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-success, #10b981)', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={11} /> Aplicado al documento:</div>
                    {m.actions.map((act, idx) => (<div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)', fontStyle: 'italic' }}>— {act.type === 'update_text' ? 'Texto actualizado' : act.type === 'set_type' ? `Convertido a ${act.element_type}` : act.type}</div>))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isSending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', alignSelf: 'flex-start' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary, #4f7cff) 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}><Sparkles size={12} /></div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--surface-elevated, #ffffff)', border: '1px solid var(--border-subtle, #e5e7eb)', borderRadius: '4px 14px 14px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--text-secondary, #6b7280)', display: 'inline-block', animationDelay: '0ms' }} />
              <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--text-secondary, #6b7280)', display: 'inline-block', animationDelay: '200ms' }} />
              <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--text-secondary, #6b7280)', display: 'inline-block', animationDelay: '400ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle, #e5e7eb)', backgroundColor: 'var(--surface-subtle, #f9fafb)', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #6b7280)', marginBottom: '2px', letterSpacing: '0.05em' }}>Acciones rápidas</div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {QUICK_ACTIONS.map((qa, i) => {
            const Icon = qa.icon;
            return (
              <button key={i} type="button" onClick={() => handleSend(qa.prompt)} disabled={isSending} title={qa.sublabel} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--surface-elevated, #ffffff)', border: `1px solid var(--border-subtle, #e5e7eb)`, borderRadius: '8px', color: 'var(--text-main, #1a1a2e)', cursor: isSending ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', opacity: isSending ? 0.6 : 1, flexShrink: 0, transition: 'border-color 0.15s, box-shadow 0.15s' }} onMouseEnter={(e) => { if (!isSending) (e.currentTarget as HTMLElement).style.borderColor = qa.color; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle, #e5e7eb)'; }}>
                <Icon size={12} style={{ color: qa.color, flexShrink: 0 }} />{qa.label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle, #e5e7eb)', backgroundColor: 'var(--surface-elevated, #ffffff)', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={selectedElement ? `Instrucción sobre '${selectedElement.text?.slice(0, 25) || selectedElement.type}'...` : 'Instrucción de edición para la IA...'} disabled={isSending} style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e5e7eb)', fontSize: '12px', outline: 'none', fontFamily: 'inherit', backgroundColor: 'var(--app-bg, #f8f9fa)', color: 'var(--text-main, #1a1a2e)', transition: 'border-color 0.15s' }} onFocus={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--accent-primary, #4f7cff)'; }} onBlur={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border-subtle, #e5e7eb)'; }} />
        <button type="submit" disabled={!input.trim() || isSending} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-primary, #4f7cff) 0%, #7c3aed 100%)', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !input.trim() || isSending ? 'not-allowed' : 'pointer', opacity: !input.trim() || isSending ? 0.5 : 1, flexShrink: 0, transition: 'opacity 0.15s' }}>
          {isSending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
        </button>
      </form>
    </div>
  );
};
