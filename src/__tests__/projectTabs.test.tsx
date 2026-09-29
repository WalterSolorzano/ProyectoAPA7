/**
 * WordAPA7 — el strip de pestañas y la barra de acciones son dos cosas.
 *
 * Con un solo documento el strip no sirve para nada (su único trabajo es
 * navegar entre proyectos) y su nombre ya vive en la topbar. Pero el botón de
 * desborde abre el Explorador de Proyecto (`ProjectFolderModal`) y el cajón de
 * imágenes (`ProjectImagesDrawer`), y no hay ningún otro montaje de esos dos
 * módulos en `src/`: un guard `tabs.length < 2` antes del return los dejaba
 * inalcanzables en el estado más común de la app.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ProjectTabs } from '../components/layout/ProjectTabs';

vi.mock('../components/project/ProjectFolderModal', () => ({
  ProjectFolderModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="folder" /> : null),
}));
vi.mock('../components/project/ProjectImagesDrawer', () => ({
  ProjectImagesDrawer: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="images" /> : null),
}));
vi.mock('../components/project/MergeDocumentsModal', () => ({
  MergeDocumentsModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="merge" /> : null),
}));

const tab = (n: number) => ({ session_id: `s${n}`, file_name: `Doc ${n}.docx`, elements: [] });
const conTabs = (n: number) => Array.from({ length: n }, (_, i) => tab(i + 1)) as never;

const abrirDesborde = () => fireEvent.click(screen.getByRole('button', { name: 'Más acciones del proyecto' }));

describe('ProjectTabs — el guard es del strip, no de la pantalla', () => {
  beforeEach(() => {
    /* `exploradorAbierto` tambien se limpia: es estado de un store singleton y
       sobrevive entre tests. Sin este reset, el primer test que abre el
       Explorador lo deja en `true` y el siguiente arranca abierto — el mismo
       modo de fallo que hace que un guardián dependa del orden en que corre. */
    useDocStore.setState({
      tabs: conTabs(1), activeTabIndex: 0, isLoading: false, projectImages: [],
      exploradorAbierto: false,
    } as never);
  });

  it('con un documento no hay lista de pestañas: su nombre ya vive en la topbar', () => {
    render(<ProjectTabs />);
    expect(screen.queryByText('Doc 1.docx')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir otra versión (.docx)' })).toBeNull();
  });

  it('con un documento, el boton de Carpeta escribe el estado del Explorador', () => {
    /* `AGENTS.md` §5 nombra este módulo como principal: es el lugar desde donde
       se abre la carpeta de trabajo y se combinan retazos.

       LO QUE CAMBIO Y POR QUE (F7 Task 5): este archivo antes afirmaba que el
       `ProjectFolderModal` aparecia DENTRO de `ProjectTabs`. Ese era el montaje
       UNICO de la app, y `ProjectTabs` hace `return null` con cero documentos:
       el Explorador era inalcanzable en el estado más común. El modal se montó
       en `AppShell`, que vive siempre, y ahora hay un destino en el rail.

       La garantía NO se relaja: lo que se afirma ahora es que el botón de
       `ProjectTabs` y el destino del rail abren la MISMA cosa. Antes se
       afirmaba "este componente monta el modal", que es un detalle de montaje;
       ahora se afirma "este botón abre el Explorador", que es lo que la persona
       usa. Un botón que pone `true` y un rail que alterna el mismo flag son dos
       caminos a una verdad, y el modal se verifica montado en
       `proyectoEstaAccesible.test.tsx`. */
    render(<ProjectTabs />);
    expect(useDocStore.getState().exploradorAbierto).toBe(false);
    abrirDesborde();
    fireEvent.click(screen.getByTitle('Explorador de archivos y carpeta del proyecto'));
    expect(useDocStore.getState().exploradorAbierto).toBe(true);
  });

  it('con un documento, el cajón de imágenes también', () => {
    render(<ProjectTabs />);
    abrirDesborde();
    fireEvent.click(screen.getByTitle('Abrir carpeta de imágenes del proyecto'));
    expect(screen.getByTestId('images')).toBeTruthy();
  });

  it('con un documento, "Combinar Retazos" no aparece: no hay con qué combinar', () => {
    render(<ProjectTabs />);
    abrirDesborde();
    expect(screen.queryByText('Combinar Retazos')).toBeNull();
  });

  it('con dos documentos vuelve el strip completo', () => {
    useDocStore.setState({ tabs: conTabs(2), activeTabIndex: 0 } as never);
    render(<ProjectTabs />);
    expect(screen.getByText('Doc 1.docx')).toBeTruthy();
    expect(screen.getByText('Doc 2.docx')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir otra versión (.docx)' })).toBeTruthy();
    abrirDesborde();
    expect(screen.getByText('Combinar Retazos')).toBeTruthy();
  });

  it('sin ningún documento, el botón de desborde tampoco se dibuja', () => {
    // Con cero pestañas no hay proyecto al que abrirle la carpeta: el botón
    // sería una promesa sin destino.
    useDocStore.setState({ tabs: [], activeTabIndex: 0 } as never);
    render(<ProjectTabs />);
    expect(screen.queryByRole('button', { name: 'Más acciones del proyecto' })).toBeNull();
  });
});
