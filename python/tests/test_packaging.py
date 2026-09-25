"""Empaquetado: pyproject [project] consistente con el layout real.

Indices de comportamiento (mejora #2, alcance A):
1. pyproject declara build-system + [project] instalable.
2. py-modules cubre EXACTAMENTE los modulos sueltos de python/ (anti-drift).
3. [project].dependencies es espejo de requirements.txt (anti-drift).
4. El mapa package-dir apunta a python/ y find descubre subpaquetes.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

try:
    import tomllib
except ModuleNotFoundError:          # py<3.10 no trae parser TOML
    tomllib = pytest.importorskip(
        "tomli", reason="sin parser TOML (tomllib/tomli) en este interprete")

ROOT = Path(__file__).resolve().parents[2]


def _pyproject() -> dict:
    with open(ROOT / "pyproject.toml", "rb") as fh:
        return tomllib.load(fh)


def test_build_system_y_project_declarados():
    data = _pyproject()
    bs = data.get("build-system", {})
    assert bs.get("build-backend") == "setuptools.build_meta"
    assert any("setuptools" in r for r in bs.get("requires", [])), (
        "build-system debe requerir setuptools")

    proj = data.get("project", {})
    assert proj.get("name") == "wordapa7"
    assert re.fullmatch(r"\d+\.\d+\.\d+", proj.get("version", "")), (
        f"version no semver: {proj.get('version')!r}")
    assert proj.get("requires-python", "").startswith(">="), (
        "requires-python ausente")
    assert proj.get("dependencies"), "dependencies vacias"
    assert proj.get("readme") == "README.md"
    assert (ROOT / "README.md").exists()


def test_py_modules_cubren_modulos_soltos():
    """Archivo .py nuevo en python/ sin registrar en py-modules -> rojo."""
    st = _pyproject()["tool"]["setuptools"]
    mods = set(st.get("py-modules", []))
    reales = {p.stem for p in (ROOT / "python").glob("*.py")}
    assert mods == reales, (
        f"py-modules desincronizado: faltan={sorted(reales - mods)} "
        f"sobran={sorted(mods - reales)}")


def test_dependencies_espejo_requirements():
    data = _pyproject()
    deps = set(data["project"]["dependencies"])
    reqs = set()
    for line in (ROOT / "requirements.txt").read_text(
            encoding="utf-8").splitlines():
        s = line.strip()
        if s and not s.startswith("#"):
            reqs.add(s)
    assert deps == reqs, (
        f"dependencies != requirements.txt: faltan={sorted(reqs - deps)} "
        f"sobran={sorted(deps - reqs)}")


def test_layout_paquete_apunta_a_python():
    data = _pyproject()
    st = data["tool"]["setuptools"]
    assert st.get("package-dir", {}).get("") == "python"
    assert st["packages"]["find"]["where"] == ["python"]
