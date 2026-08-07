import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFViewer } from '@react-pdf/renderer';
import { useDocStore } from '../../store/useDocStore';
import { useDebounce } from 'use-debounce';
import { DocumentModel, PortadaData } from '../../types';

// Estilos base de APA 7
const styles = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 60,
    paddingHorizontal: 54,
    fontSize: 12,
    lineHeight: 2.0, // Doble espacio (APA)
    color: '#000000',
  },
  title: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  paragraph: {
    marginBottom: 10,
    textIndent: 36, // Sangría de 0.5 pulgadas
    textAlign: 'left',
  },
  heading1: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  heading2: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
    marginTop: 10,
    marginBottom: 10,
  },
  bullet: {
    marginBottom: 8,
    paddingLeft: 24,
    textAlign: 'left',
  },
  referenceItem: {
    marginLeft: 36, // Sangría francesa
    textIndent: -36,
    marginBottom: 10,
  },
  coverPage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 150,
  },
  coverLine: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 1.6,
  },
  coverTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 1.6,
  },
  footer: {
    position: 'absolute',
    top: 46,
    right: 54,
    fontSize: 12,
    color: '#000000',
  },
});

// Pie de página: número de hoja empezando en 1 DESPUÉS de la portada.
const PageNumber: React.FC<{ startAt?: number }> = ({ startAt = 1 }) => (
  <View
    fixed
    render={({ pageNumber }) => (
      <Text style={styles.footer}>{Math.max(startAt, pageNumber)}</Text>
    )}
  />
);

/** Líneas de texto reales de la portada (del documento, no placeholders). */
function getCoverLines(doc: DocumentModel, portada: PortadaData): string[] {
  const lines: string[] = [];

  // 1) Contenido REAL de la portada detectada (párrafos / bloques de portada)
  const coverElems = doc.elements.filter(
    (e) => e.type === 'portada_block' || (e as any).is_cover_section,
  );
  for (const e of coverElems) {
    if (e.text && e.text.trim()) {
      lines.push(...e.text.split('\n'));
    }
  }

  // 2) Fallback: campos de portada editados por el usuario
  if (lines.length === 0) {
    const fields: [string, string | undefined][] = [
      ['title', portada.title],
      ['author', portada.author],
      ['institution', portada.institution],
      ['course', portada.course],
      ['instructor', portada.instructor],
      ['date', portada.date],
    ];
    for (const [, v] of fields) {
      if (v && v.trim()) {
        lines.push(...v.split('\n'));
      }
    }
  }

  // 3) Último recurso: campos parseados de la portada original
  if (lines.length === 0 && doc.portada?.fields) {
    const order = ['title', 'author', 'institution', 'course', 'instructor', 'date'];
    for (const key of order) {
      const v = doc.portada.fields[key];
      if (v && v.trim()) lines.push(...v.split('\n'));
    }
  }

  return lines.filter((l) => l.trim()).slice(0, 40);
}

export const ReactPDFPreview: React.FC = () => {
  const { doc, portada } = useDocStore();
  const [debouncedDoc] = useDebounce(doc, 500);
  const [debouncedPortada] = useDebounce(portada, 500);

  if (!debouncedDoc) {
    return <div className="text-center p-8" style={{ color: 'var(--text-tertiary)' }}>No hay documento para previsualizar.</div>;
  }

  const isLandscape = debouncedDoc.has_landscape_sections === true;
  const coverOrientation =
    debouncedDoc.meta?.sections?.[0]?.orientation === 'landscape' ? 'landscape' : 'portrait';
  const bodyOrientation = isLandscape ? 'landscape' : 'portrait';
  const coverLines = getCoverLines(debouncedDoc, debouncedPortada);

  // Generamos el documento dinámico
  const PDFDoc = () => (
    <Document>
      {/* Portada real del documento — sin número de página */}
      <Page size="LETTER" orientation={coverOrientation} style={[styles.page, styles.coverPage]} wrap={false}>
        {coverLines.length === 0 && (
          <Text style={styles.coverTitle}>{debouncedPortada.title || 'Portada'}</Text>
        )}
        {coverLines.map((line, i) => (
          <Text key={i} style={i === 0 && coverLines.length > 1 ? styles.coverTitle : styles.coverLine}>
            {line}
          </Text>
        ))}
      </Page>

      {/* Cuerpo del Documento — número de hoja desde 1 (sin contar portada) */}
      <Page size="LETTER" orientation={bodyOrientation} style={styles.page} wrap={true}>
        <PageNumber startAt={1} />
        {debouncedDoc.elements.map((elem) => {
          if (elem.type === 'heading') {
            if (elem.heading_level === 1) {
              return <Text key={elem.id} style={styles.heading1}>{elem.text}</Text>;
            }
            return <Text key={elem.id} style={styles.heading2}>{elem.text}</Text>;
          }

          if (elem.type === 'paragraph') {
            return <Text key={elem.id} style={styles.paragraph}>{elem.text}</Text>;
          }

          if (elem.type === 'bullet' || elem.type === 'numbered_list') {
            return <Text key={elem.id} style={styles.bullet}>{elem.text}</Text>;
          }

          if (elem.type === 'table' && elem.table_info) {
            return <Text key={elem.id} style={styles.paragraph}>[Tabla {elem.table_info.table_number}: {elem.table_info.caption}]</Text>;
          }

          if (elem.type === 'page_break') {
            return null;
          }

          return null;
        })}
      </Page>

      {/* Referencias — nueva hoja, sin número repetido de portada */}
      {debouncedDoc.referencias && debouncedDoc.referencias.length > 0 && (
        <Page size="LETTER" orientation={bodyOrientation} style={styles.page} wrap={true}>
          <PageNumber startAt={1} />
          <Text style={styles.heading1}>Referencias</Text>
          {debouncedDoc.referencias.map((ref: any) => (
            <Text key={ref.id} style={styles.referenceItem}>{ref.text || ref.raw_text}</Text>
          ))}
        </Page>
      )}
    </Document>
  );

  return (
    <div className="w-full h-full">
      <PDFViewer style={{ width: '100%', height: '100%' }}>
        <PDFDoc />
      </PDFViewer>
    </div>
  );
};
