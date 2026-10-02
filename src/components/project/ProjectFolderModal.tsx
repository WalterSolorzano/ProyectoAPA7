import React, { useRef, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { parseDocumentVersion } from '../../lib/projectUtils';
import { crearProyecto } from '../../lib/proyecto';
import { Folder, FolderSearch, FileText, Image as ImageIcon, Plus, ExternalLink, X, Check, Layers } from 'lucide-react';

/** La carpeta de un archivo, si el archivo la trae.
 *
 *  En Electron, `file.path` es la ruta completa y la carpeta es su directorio.
 *  En el navegador no hay `.path`, y devolver `null` es lo honesto: el backend
 *  no puede releer una carpeta que no conoce. */
function directorioDeArchivo(file: File): string | null {
  const ruta = (file as File & { path?: string }).path;
  if (!ruta) return null;
  const i = Math.max(ruta.lastIndexOf('\\'), ruta.lastIndexOf('/'));
  return i > 0 ? ruta.slice(0, i) : null;
}

interface ProjectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMerge?: () => void;
}

export const ProjectFolderModal: React.FC<ProjectFolderModalProps> = ({
  isOpen,
  onClose,
  onOpenMerge,
}) => {
  const {
    tabs,
    activeTabIndex,
    switchToTab,
    removeTab,
    uploadFile,
    isLoading,
    proyecto,
    cargarProyectos,
    projectImages,
    addProjectImage,
    activeFilePath,
    showToast,
    sincronizarProyectoActual,
  } = useDocStore();

  const fileDocxRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  /* F7 Task 2: al abrir el Explorador se leen los proyectos del backend, para
     que la lista offerta sea la de verdad y no solo lo que esta pestana recuerda
     de indexedDB. Sin esto, `api.listarProyectos` no la llamaria nadie: una
     funcion escrita, probada en Python, y que el frontend no usa. Es la clase de
     superficie que la fase declara terminada y que no lo esta. */
  useEffect(() => {
    if (isOpen) {
      void cargarProyectos();
    }
  }, [isOpen, cargarProyectos]);

  if (!isOpen) return null;

  /* F7 Task 3. EL NOMBRE DEL PROYECTO.
     *
     * Antes: `activeParsed?.projectName || 'Proyecto APA 7'`. O sea, el nombre de
     * un trabajo salia del nombre del archivo de la pestaña activa, y cuando no
     * habia pestaña la pantalla decia, con todas las letras, "Proyecto APA 7".
     * Un nombre inventado en pantalla es peor que no tener chrome: la persona lo
     * lee y razona sobre un trabajo que no existe.
     *
     * Ahora el nombre viene de `store.proyecto`, que es persistido. Sin proyecto
     * NO HAY titulo: el bloque entero se sale del render. No se muestra un
     * nombre de reserva, porque cualquier nombre de reserva es mentira, y la
     * mentira mas cara es la que se lee como cierta.
     *
     * Y `parseDocumentVersion` sigue usandose ABAJO, para la ETIQUETA DE VERSION
     * de cada documento de la lista: eso es un dato del archivo, y como dato del
     * archivo es correcto. Lo que no puede ser un dato del archivo es el nombre
     * del proyecto. */
  const nombreProyecto = proyecto?.nombre ?? null;

  const handleSelectFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const docxFiles = files.filter((f) => f.name.toLowerCase().endsWith('.docx'));
    const imgFiles = files.filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f.name));

    // Cargar imágenes detectadas en la carpeta
    /* `addProjectImage` es `async` desde la F7: sube a disco. El `await` en
       serie es lo correcto acá y no una pena: el Explorador ya subía los `.docx`
       uno por uno, y estas son archivos chicos contra un documento completo. */
    for (const img of imgFiles) {
      await addProjectImage(img);
    }

    if (docxFiles.length > 0) {
      /* F7 Task 4. UNA CARPETA ES UNA OPERACIÓN, NO VEINTE.
       *
       * Antes esto subía un `.docx` por archivo, en serie, cada uno con su
       * auditoría completa y su `isLoading`: veinte capítulos eran veinte
       * pantallas de carga seguidas. Con la entidad del backend, "vincular una
       * carpeta" es UNA llamada a sync: el backend relee el disco y devuelve
       * qué encontró.
       *
       * Y el progreso va por `loadingQue`, que el overlay de carga (F1) ya
       * sabe mostrar a través de su prop `que`. Un spinner mudo obliga a
       * adivinar, y adivinar mientras se espera es la peor manera de esperar.
       *
       * Si todavía no hay proyecto, se crea con el nombre del primer archivo y
       * la carpeta si el archivo la trae (Electron sí, navegador no). Sin
       * proyecto no hay contra qué sincronizar. */
      let proyecto = useDocStore.getState().proyecto;
      if (!proyecto) {
        const raiz = directorioDeArchivo(docxFiles[0]);
        await useDocStore.getState().setProyecto(
          crearProyecto({
            nombre: parseDocumentVersion(docxFiles[0].name).projectName,
            raiz,
          }),
        );
        proyecto = useDocStore.getState().proyecto;
      }
      if (proyecto) {
        useDocStore.setState({ loadingQue: `Sincronizando carpeta: ${docxFiles.length} documentos...` });
        const hallados = await sincronizarProyectoActual();
        useDocStore.setState({ loadingQue: null });
        showToast(
          `Carpeta vinculada: ${hallados?.length ?? 0} docx y ${imgFiles.length} imágenes`,
          'success',
        );
      }
    } else {
      showToast(`Carpeta escaneada: ${imgFiles.length} imágenes añadidas`, 'info');
    }

    e.target.value = '';
  };

  const handleAddDocx = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      showToast(`Documento "${file.name}" agregado al proyecto`, 'success');
      e.target.value = '';
    }
  };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      await addProjectImage(f);
    }
    if (files.length > 0) {
      showToast(`${files.length} imagen(es) agregada(s) al proyecto`, 'success');
    }
    e.target.value = '';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-ink-a55)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '560px',
          maxHeight: '85vh',
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-accent-soft)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Folder size={18} strokeWidth="var(--icon-stroke)" />
            </div>
            {/* El titulo del proyecto NO tiene bloque vacio a su lado: sin proyecto
                no hay nombre, y un `div` de 14px reservado para un texto que no
                existe empuja el contenido y deja el hueco como si algo faltara.
                Faltaba algo: falta el proyecto. */}
            <div style={{ minWidth: 0, flex: 1 }}>
            {nombreProyecto && (
              <div
                data-testid="proyecto-titulo"
                style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreProyecto}</span>
              </div>
            )}
            {/* LA RUTA Y EL BOTON NO DEPENDEN DEL NOMBRE. La fila vivia dentro
                  del bloque del titulo, o sea que el "Abrir carpeta" —el unico
                  boton de esta pantalla que hace algo con el disco— era
                  inalcanzable sin proyecto. Y `activeFilePath` se establece al
                  SUBIR un archivo (F7 Task 3), que no abre ningun proyecto. Un
                  boton que depende de un dato que su propio camino no escribe
                  es un boton muerto, y hay que meter el boton y su dato al mismo
                  nivel para que se pueda ver que existen juntos. */}
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                {activeFilePath ? (
                  <>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {activeFilePath}
                    </span>
                    {(window as any).electronAPI?.showItemInFolder && (
                      <button
                        type="button"
                        onClick={() => (window as any).electronAPI.showItemInFolder(activeFilePath)}
                        title="Abrir ubicación en el Explorador de Windows"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                          padding: '1px 4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                        }}
                      >
                        <ExternalLink size={11} /> Abrir carpeta
                      </button>
                    )}
                  </>
                ) : (
                  <span>Carpeta de trabajo y recursos del proyecto</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              marginLeft: '8px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sección de Documentos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                Documentos en este proyecto ({tabs.length})
              </span>
              <button
                type="button"
                onClick={() => fileDocxRef.current?.click()}
                disabled={isLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Agregar .docx</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tabs.map((tab, idx) => {
                const isActive = idx === activeTabIndex;
                const parsed = parseDocumentVersion(tab.file_name);
                return (
                  <div
                    key={tab.session_id}
                    onClick={() => switchToTab(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: isActive ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <FileText size={15} color={isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isActive ? 700 : 500,
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tab.file_name}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                          color: isActive ? 'var(--color-text-on-accent)' : 'var(--text-secondary)',
                        }}
                      >
                        {parsed.versionLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isActive && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={12} /> Activo
                        </span>
                      )}
                      {tabs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTab(idx);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          title="Cerrar versión"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sección de Recursos e Imágenes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                Imágenes y Anexos vinculados ({projectImages.length})
              </span>
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Subir imágenes</span>
              </button>
            </div>

            {projectImages.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                No hay imágenes registradas aún en este proyecto. Puedes subir figuras o vincular una carpeta completa.
              </div>
            ) : (
              /* F7 Task 4. `slice(0, 8)` sin "ver mas" era un recorte invisible:
                 las imagenes de la novena en adelante existian en el store, no
                 se veian, y nadie decia cuantas faltaban. Ahora se ven TODAS:
                 una imagen en el store que no se ve es un recurso que la persona
                 no sabe que tiene. */
              <div data-testid="galeria-imagenes" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {projectImages.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      height: '60px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      position: 'relative',
                      backgroundColor: 'var(--surface-subtle)',
                    }}
                    title={img.name}
                  >
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      /* `contain` y NO `cover`: sobre un logo vertical, `cover`
                         lo recorta a una banda y lo que se ve no es el logo. Es
                         el mismo defecto de la miniatura de la portada, y con
                         el logo de la UNI se nota a simple vista. */
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pie con acciones de carpeta */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-main)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Folder size={13} />
            <span>Vincular carpeta completa...</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {tabs.length > 1 && onOpenMerge && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMerge();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-elevated)',
                  color: 'var(--text-main)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Layers size={13} />
                <span>Combinar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '11.5px', fontWeight: 700 }}
            >
              Listo
            </button>
          </div>
        </div>

        {/* Inputs ocultos */}
        <input
          ref={fileDocxRef}
          type="file"
          accept=".docx"
          style={{ display: 'none' }}
          onChange={handleAddDocx}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error atributo no estandar webkitdirectory fuera de los tipos de React
          webkitdirectory="true"
          directory=""
          multiple
          style={{ display: 'none' }}
          onChange={handleSelectFolder}
        />
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleAddImages}
        />
      </div>
    </div>
  );
};
