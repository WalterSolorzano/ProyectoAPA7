"""
WordAPA7 — el write-back a Word, que es lo mas destructivo de la app.

`/api/send-to-word/{session_id}` copia el `.docx` generado sobre el archivo
ORIGINAL del estudiante. No hay vuelta: si el generado estaba mal, el original
no existe mas. Y hay un boton que lo dispara.

Estos tests fijan las dos cosas que lo hacen una funcion y no un accidente:

  1. SIEMPRE queda una copia de seguridad antes de pisar, y se escribe UNA sola
     vez: el segundo write-back del mismo archivo no crea un segundo backup ni
     pisa el primero, que para entonces ya seria el contenido generado.
  2. Con cambios sin guardar en Word no se cierra ni se copia: el endpoint
     devuelve `requiere_confirmacion` y no toca nada. `Close(SaveChanges=0)`
     sobre un documento abierto borra lo que la persona escribio desde la
     ultima lectura.

EL DOBLE DE PRUEBA. La rama de COM se prueba con `FakeWord`, escrito aca, no
con el COM real: un test que necesita Word abierto no corre en CI y no vigila
nada. `AGENTS.md` exige COM 100% bajo demanda; un test que lo levanta al
importar rompe esa regla ademas de no probar nada.
"""

import sys
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient

import modules.word_com as word_com
from main import STORAGE_DIR, app

ORIGINAL = b"contenido-del-estudiante"
GENERADO = b"contenido-generado-en-apa-7"


# ── El cliente y la sesion ────────────────────────────────────────────────────

@pytest.fixture
def client():
    """TestClient SIN context manager: el context manager dispara el lifespan,
    y en el shutdown `main.py` llama a `word_com_service.stop()`, que intenta
    Quit sobre un COM que el test no abrio. Es el mismo motivo que documenta
    `test_update_element_table.py`."""
    return TestClient(app)


@pytest.fixture
def sesion():
    """Sesion con un output.docx generado, y su carpeta para limpiar."""
    session_id = "test-send-to-word"
    out_dir = STORAGE_DIR / "sessions" / session_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "output.docx").write_bytes(GENERADO)
    yield session_id
    import shutil as _shutil
    _shutil.rmtree(out_dir, ignore_errors=True)


@pytest.fixture
def destino(tmp_path):
    """El `.docx` del estudiante: el archivo que el write-back pisa."""
    d = tmp_path / "tesis.docx"
    d.write_bytes(ORIGINAL)
    return d


@pytest.fixture
def sin_com(monkeypatch):
    """Word no disponible: la rama que se ejercita es la del respaldo en disco.

    Se declara en vez de confiar en que la maquina no tenga Word, para que el
    mismo test corra igual en una con Word y en una sin."""
    @contextmanager
    def _que_falla():
        raise OSError("COM no disponible en el test")
        yield  # pragma: no cover - el raise de arriba nunca deja llegar

    monkeypatch.setattr(word_com, "word_session", _que_falla)


# ── El doble de prueba de la rama de COM ─────────────────────────────────────

class FakeDocumento:
    """Un documento de Word: lo unico que el endpoint le pide."""

    def __init__(self, full_name, saved=True):
        self.FullName = full_name
        self.Saved = saved
        self.llamadas = []

    def Save(self):  # noqa: N802 - el nombre es el de COM
        self.llamadas.append(("Save",))
        self.Saved = True

    def Close(self, SaveChanges=0):  # noqa: N803 - el nombre es el de COM
        self.llamadas.append(("Close", SaveChanges))
        self.Saved = True


class FakeDocuments:
    def __init__(self, documentos):
        self._docs = list(documentos)

    @property
    def Count(self):  # noqa: N802 - el nombre es el de COM
        return len(self._docs)

    def __call__(self, indice):
        return self._docs[indice - 1]

    def Open(self, ruta):  # noqa: N802 - el nombre es el de COM
        self.abrio = ruta
        return None


class FakeWord:
    """La aplicacion de Word: `Documents`, y nada mas que el endpoint use."""

    def __init__(self, documentos):
        self.Documents = FakeDocuments(documentos)


@pytest.fixture
def palabra_sin_certeza(monkeypatch):
    """Fabrica `word_session` con los documentos que se le pidan."""
    def _instalar(*documentos):
        app_falso = FakeWord(documentos)
        @contextmanager
        def _sesion():
            yield app_falso
        monkeypatch.setattr(word_com, "word_session", _sesion)
        return app_falso
    return _instalar


# ── 1. La copia de seguridad ──────────────────────────────────────────────────

class TestCopiaDeSeguridad:

    def test_el_write_back_deja_un_backup_antes_de_pisar(self, client, sesion, destino, sin_com):
        """El Review Focus #1.

        `shutil.copy2` sobre el original del estudiante, sin red: el primer
        principio del producto dice no romper jamas su trabajo, y hoy se rompe
        sin vuelta."""
        r = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(destino)})

        assert r.status_code == 200, r.text
        assert destino.read_bytes() == GENERADO
        backup = destino.with_name(destino.name + ".bak")
        assert backup.exists(), "no hay copia de seguridad del original"
        # Y tiene el CONTENIDO ORIGINAL: si el backup se hiciera despues de
        # pisar, estaria aqui el generado y esta prueba pasaria igual.
        assert backup.read_bytes() == ORIGINAL

    def test_la_respuesta_dice_donde_esta_el_backup(self, client, sesion, destino, sin_com):
        """Si no se le dice a la persona, no puede ir a buscarlo."""
        r = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(destino)})

        assert r.status_code == 200, r.text
        esperado = str(destino.with_name(destino.name + ".bak"))
        assert r.json()["backup"] == esperado

    def test_un_segundo_write_back_no_crea_un_segundo_backup(self, client, sesion, destino, sin_com):
        """Tres write-back del mismo archivo no dejan tres backups, y el
        primero no puede pisarse con el contenido ya generado."""
        for _ in range(3):
            r = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(destino)})
            assert r.status_code == 200, r.text

        backups = list(destino.parent.glob("tesis.docx.bak*"))
        assert len(backups) == 1, f"hubo mas de un backup: {backups}"
        # El original sobrevive intacto. Si el segundo write-back hubiera
        # reescrito el backup, aca estaria GENERADO.
        assert backups[0].read_bytes() == ORIGINAL
        # Y el segundo write-back no vuelve a anunciarlo: ya estaba.
        assert r.json()["backup"] is None

    def test_si_el_backup_falla_no_se_pisa_el_original(self, client, sesion, destino, sin_com, monkeypatch):
        """Si no se puede escribir el backup, la operacion se cancela.

        Es peor quedarse sin backup que no tener la funcion."""
        import shutil

        _real = shutil.copy2

        def copy2_que_falla(origen, destino_, *args, **kwargs):
            if str(destino_).endswith(".bak"):
                raise OSError("disco lleno")
            return _real(origen, destino_)

        monkeypatch.setattr(shutil, "copy2", copy2_que_falla)

        r = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(destino)})

        assert r.status_code >= 400, f"la operacion se dio por buena: {r.status_code}"
        assert destino.read_bytes() == ORIGINAL, "el original se piso sin backup"
        assert not destino.with_name(destino.name + ".bak").exists()


# ── 2. Lo que esta sin guardar ────────────────────────────────────────────────

class TestSinGuardar:

    def test_no_cierra_un_documento_con_cambios_sin_guardar(
        self, client, sesion, destino, palabra_sin_certeza,
    ):
        """El Review Focus #2.

        `Close(SaveChanges=0)` descarta lo que la persona escribio en Word desde
        la ultima lectura. Ese 0 existe en `word_com.py` para cerrar la app, que
        es otra cosa: aca hay un documento abierto con trabajo sin guardar.

        Con cambios sin guardar, el endpoint NO cierra, NO copia y dice que
        pasa."""
        doc = FakeDocumento(str(destino), saved=False)
        palabra_sin_certeza(doc)

        r = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(destino)})

        assert r.status_code == 409, f"hoy contesta {r.status_code}: {r.text}"
        cuerpo = r.json()
        assert cuerpo["requiere_confirmacion"] is True
        assert cuerpo["ok"] is False
        # Nadie lo toco: ni se cerro, ni se copio.
        assert doc.llamadas == [], f"cerro el documento: {doc.llamadas}"
        assert doc.Saved is False
        assert destino.read_bytes() == ORIGINAL
        assert not destino.with_name(destino.name + ".bak").exists()

    def test_con_forzar_cierta_lo_hace(self, client, sesion, destino, palabra_sin_certeza):
        """La salida: la persona decide. Un boton que descarta su trabajo sin
        preguntar no es una funcion, es una trampa."""
        doc = FakeDocumento(str(destino), saved=False)
        palabra_sin_certeza(doc)

        r = client.post(
            f"/api/send-to-word/{sesion}",
            json={"dest_path": str(destino), "forzar": True},
        )

        assert r.status_code == 200, r.text
        assert destino.read_bytes() == GENERADO
        assert doc.llamadas == [("Close", 0)]

    def test_con_guardar_lo_guarda_primero_y_lo_manda(self, client, sesion, destino, palabra_sin_certeza):
        """La otra salida, la que no pierde trabajo: guardar en Word y mandar.

        El boton tiene que hacer algo. Un boton que dice "guardar y enviar" y no
        guarda es la misma trampa que el toast, con mas palabras."""
        doc = FakeDocumento(str(destino), saved=False)
        palabra_sin_certeza(doc)

        r = client.post(
            f"/api/send-to-word/{sesion}",
            json={"dest_path": str(destino), "guardar": True},
        )

        assert r.status_code == 200, r.text
        # Guardo ANTES de cerrar y de copiar: el orden es el del rescate, no el
        # del descarte. Un `Save` despues del `Close(0)` no guardaria nada.
        assert doc.llamadas == [("Save",), ("Close", 0)], doc.llamadas
        assert destino.read_bytes() == GENERADO

    def test_guardar_sin_cambios_sin_guardar_no_hace_nada_raro(self, client, sesion, destino, palabra_sin_certeza):
        """Con el documento limpio no hay nada que guardar: la peticion se
        cumple igual, sin un `Save` de mentira."""
        doc = FakeDocumento(str(destino), saved=True)
        palabra_sin_certeza(doc)

        r = client.post(
            f"/api/send-to-word/{sesion}",
            json={"dest_path": str(destino), "guardar": True},
        )

        assert r.status_code == 200, r.text
        assert doc.llamadas == [("Close", 0)]

    def test_sin_cambios_sin_guardar_cierra_y_copia(self, client, sesion, destino, palabra_sin_certeza):
        """La guarda no puede volver imposible la funcion: con el documento
        limpio, el write-back hace lo que siempre hizo."""
        doc = FakeDocumento(str(destino), saved=True)
        palabra_sin_certeza(doc)

        r = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(destino)})

        assert r.status_code == 200, r.text
        assert doc.llamadas == [("Close", 0)]
        assert destino.read_bytes() == GENERADO
        assert r.json()["method"] == "com"

    def test_lo_que_no_hay_que_adivinar_del_archivo(self, client, sesion, destino, sin_com):
        """Sin Word abierto no hay nada que preguntar: se copia y se avisa que
        hay que reabrirlo a mano."""
        r = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(destino)})

        assert r.status_code == 200, r.text
        assert r.json()["method"] == "copy"
        assert "requiere_confirmacion" not in r.json()

    def test_lo_que_no_se_va_a_pisar_no_se_toca(self, client, sesion, tmp_path):
        """Sin documento generado, o sin destino valido, no hay nada que
        respaldar ni que pisar."""
        sin_generar = client.post("/api/send-to-word/sesion-que-no-genero", json={"dest_path": str(tmp_path / "a.docx")})
        assert sin_generar.status_code == 404

        inexistente = client.post(
            f"/api/send-to-word/{sesion}", json={"dest_path": str(tmp_path / "no-existe.docx")},
        )
        assert inexistente.status_code == 400

        otra_extension = tmp_path / "tesis.pdf"
        otra_extension.write_bytes(b"pdf")
        mal = client.post(f"/api/send-to-word/{sesion}", json={"dest_path": str(otra_extension)})
        assert mal.status_code == 400
        assert not otra_extension.with_name(otra_extension.name + ".bak").exists()
