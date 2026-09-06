import { StateCreator } from 'zustand';
import { DocState } from '../types';
import { PortadaData, ElementModel } from '../../types';
import * as api from '../../api/backend';

const getApiBase = () => api.getApiBase();

export const defaultPortada: PortadaData = {
  apa_format: 'student',
  use_original_cover: true,
  title: '',
  author: '',
  institution: '',
  course: '',
  grupo: '',
  instructor: '',
  date: '',
  running_head: '',
  author_note: '',
};

export function syncCoverFieldToElements(elements: ElementModel[], field: keyof PortadaData, value: string): ElementModel[] {
  if (!elements || elements.length === 0) return elements;
  const coverElems = elements.filter(e => e.is_cover_section || e.type === 'portada_block');
  if (coverElems.length === 0) return elements;

  const newElements = [...elements];

  if (field === 'title') {
    const titleElem = coverElems.find(e => 
      e.text && (e.text.toLowerCase().includes('tema:') || (e.font_size && e.font_size >= 18))
    ) || coverElems.find(e => 
      e.text && !['universidad', 'facultad', 'recinto', 'departamento', 'direccion', 'área de conocimiento'].some(kw => e.text.toLowerCase().includes(kw))
    );
    if (titleElem) {
      const idx = newElements.findIndex(e => e.id === titleElem.id);
      if (idx !== -1) {
        const prefixMatch = newElements[idx].text.match(/^(tema\s*:\s*)/i);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        newElements[idx] = { ...newElements[idx], text: prefix ? `${prefix}${value}` : value };
      }
    }
  } else if (field === 'author') {
    const authorElem = coverElems.find(e => 
      e.text && (e.text.toLowerCase().includes('elaborado por') || e.text.toLowerCase().includes('br.') || e.text.toLowerCase().includes('carnet'))
    );
    if (authorElem) {
      const idx = newElements.findIndex(e => e.id === authorElem.id);
      if (idx !== -1) {
        newElements[idx] = { ...newElements[idx], text: value };
      }
    }
  } else if (field === 'instructor') {
    const instElem = coverElems.find(e => 
      e.text && (e.text.toLowerCase().includes('docente') || e.text.toLowerCase().includes('profesor') || e.text.toLowerCase().includes('tutor') || e.text.toLowerCase().includes('ing.') || e.text.toLowerCase().includes('lic.'))
    );
    if (instElem) {
      const idx = newElements.findIndex(e => e.id === instElem.id);
      if (idx !== -1) {
        const prefixMatch = newElements[idx].text.match(/^(docente\s*:\s*|profesor\s*:\s*|tutor\s*:\s*)/i);
        const prefix = prefixMatch ? prefixMatch[1] : 'Docente: ';
        newElements[idx] = { ...newElements[idx], text: value ? `${prefix}${value}` : '' };
      }
    }
  } else if (field === 'grupo') {
    const grpElem = coverElems.find(e => e.text && e.text.toLowerCase().includes('grupo'));
    if (grpElem) {
      const idx = newElements.findIndex(e => e.id === grpElem.id);
      if (idx !== -1) {
        const prefixMatch = newElements[idx].text.match(/^(grupo\s*:\s*)/i);
        const prefix = prefixMatch ? prefixMatch[1] : 'Grupo: ';
        newElements[idx] = { ...newElements[idx], text: value ? `${prefix}${value}` : '' };
      }
    }
  } else if (field === 'date') {
    const dateElem = coverElems.find(e => 
      e.text && (e.text.toLowerCase().includes('fecha') || /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(e.text))
    );
    if (dateElem) {
      const idx = newElements.findIndex(e => e.id === dateElem.id);
      if (idx !== -1) {
        const prefixMatch = newElements[idx].text.match(/^(fecha(?:\s+de\s+entrega)?\s*:\s*)/i);
        const prefix = prefixMatch ? prefixMatch[1] : 'Fecha: ';
        newElements[idx] = { ...newElements[idx], text: value ? `${prefix}${value}` : '' };
      }
    }
  } else if (field === 'course') {
    const courseElem = coverElems.find(e => 
      e.text && (e.text.toLowerCase().includes('asignatura') || e.text.toLowerCase().includes('curso') || e.text.toLowerCase().includes('materia') || e.text.toLowerCase().includes('unidad'))
    );
    if (courseElem) {
      const idx = newElements.findIndex(e => e.id === courseElem.id);
      if (idx !== -1) {
        newElements[idx] = { ...newElements[idx], text: value };
      }
    }
  } else if (field === 'institution') {
    const instElem = coverElems.find(e => 
      e.text && (e.text.toLowerCase().includes('universidad') || e.text.toLowerCase().includes('facultad') || e.text.toLowerCase().includes('recinto') || e.text.toLowerCase().includes('direccion'))
    );
    if (instElem) {
      const idx = newElements.findIndex(e => e.id === instElem.id);
      if (idx !== -1) {
        newElements[idx] = { ...newElements[idx], text: value };
      }
    }
  }

  return newElements;
}

export const createCoverSlice: StateCreator<DocState, [], [], Partial<DocState>> = (set, get) => ({
  coverSetupDone: false,
  setCoverSetupDone: (done) => set({ coverSetupDone: done }),
  portada: defaultPortada,
  setPortada: (newPortada) => set((state) => {
    const updatedPortada = { ...state.portada, ...newPortada };
    let updatedDoc = state.doc;
    if (updatedDoc && updatedDoc.elements && updatedDoc.elements.length > 0) {
      let elements = [...updatedDoc.elements];
      for (const [k, v] of Object.entries(newPortada)) {
        if (typeof v === 'string' && v.trim()) {
          elements = syncCoverFieldToElements(elements, k as keyof PortadaData, v);
        }
      }
      updatedDoc = { ...updatedDoc, elements, portada: { ...updatedDoc.portada, ...newPortada } as any };
    }
    return { portada: updatedPortada, doc: updatedDoc };
  }),
  updateCoverField: (field, value) => {
    get().setPortada({ [field]: value });
  },
  portadaProfiles: [{ profile_name: 'Portada Estándar', created_at: new Date().toISOString(), data: defaultPortada }],
  savePortadaProfile: (name) => set((state) => {
    const profile = { profile_name: name, created_at: new Date().toISOString(), data: state.portada };
    return { portadaProfiles: [...state.portadaProfiles, profile as any] };
  }),
  showTemplateDialog: false,
  setShowTemplateDialog: (show) => set({ showTemplateDialog: show }),
  availableTemplates: [],
  fetchTemplates: async () => {
    try {
      const res = await fetch(`${getApiBase()}/templates`);
      if (res.ok) {
        const data = await res.json();
        set({ availableTemplates: data.templates || [] });
      }
    } catch (err) {
      console.warn('Error fetching templates:', err);
    }
  },
  applyTemplate: async (templateName) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const res = await fetch(`${getApiBase()}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: doc.session_id,
          template_name: templateName,
          numbering_style: 'decimal',
        }),
      });
      if (!res.ok) throw new Error('Error al aplicar plantilla');
      const result = await res.json();
      // Reload document to get updated elements
      const updatedRes = await fetch(`${getApiBase()}/session/${doc.session_id}`);
      if (updatedRes.ok) {
        const updatedDoc = await updatedRes.json();
        pushHistory(updatedDoc);
        set({ doc: updatedDoc, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error al aplicar plantilla', isLoading: false });
    }
  },
});
