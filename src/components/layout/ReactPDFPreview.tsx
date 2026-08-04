import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFViewer } from '@react-pdf/renderer';
import { useDocStore } from '../../store/useDocStore';
import { useDebounce } from 'use-debounce';

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
  coverText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
  },
  coverTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
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
// La portada (página 1 del PDF) no lleva número.
const PageNumber: React.FC<{ startAt?: number }> = ({ startAt = 1 }) => (
  <View
    fixed
    render={({ pageNumber }) => (
      <Text style={styles.footer}>{Math.max(startAt, pageNumber)}</Text>
    )}
  />
);

export const ReactPDFPreview: React.FC = () => {
  const { doc, portada } = useDocStore();
  const [debouncedDoc] = useDebounce(doc, 500);
  const [debouncedPortada] = useDebounce(portada, 500);

  if (!debouncedDoc) {
    return <div className="text-center p-8" style={{ color: 'var(--text-tertiary)' }}>No hay documento para previsualizar.</div>;
  }

  // Generamos el documento dinámico
  const PDFDoc = () => (
    <Document>
      {/* Portada Estudiantil (Simplified) — SIN número de página */}
      <Page size="LETTER" style={[styles.page, styles.coverPage]} wrap={false}>
        <Text style={styles.coverTitle}>{debouncedPortada.title || 'Título del Trabajo'}</Text>
        <Text style={styles.coverText}>{debouncedPortada.author || 'Autor(es)'}</Text>
        <Text style={styles.coverText}>{debouncedPortada.institution || 'Institución'}</Text>
        <Text style={styles.coverText}>{debouncedPortada.course || 'Curso'}</Text>
        <Text style={styles.coverText}>{debouncedPortada.instructor || 'Instructor'}</Text>
        <Text style={styles.coverText}>{debouncedPortada.date || 'Fecha'}</Text>
      </Page>

      {/* Cuerpo del Documento — número de hoja desde 1 (sin contar portada) */}
      <Page size="LETTER" style={styles.page} wrap={true}>
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
        <Page size="LETTER" style={styles.page} wrap={true}>
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
