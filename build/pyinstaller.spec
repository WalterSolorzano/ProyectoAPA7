# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('../python', 'python')]
binaries = []
# word_watcher y ssl_cert_gen se importan condicionalmente en main.py
# (dentro de if args.watcher / try-except), por lo que PyInstaller podría no
# detectarlos en su análisis estático. Se declaran explícitamente para
# asegurar que el watcher de Word y la generación de certificados SSL
# funcionen en el build empaquetado.
hiddenimports = [
    'docx', 'lxml', 'pillow', 'pydantic', 'fastapi', 'uvicorn', 'dotenv',
    'networkx', 'cryptography', 'cffi',
    'word_watcher', 'ssl_cert_gen',
]
tmp_ret = collect_all('docx')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('lxml')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

# cryptography: generacion de certificados SSL auto-firmados para el Word
# Add-in (python/ssl_cert_gen.py). Incluye extensiones nativas (OpenSSL bindings
# via cffi) que PyInstaller debe empaquetar explicitamente.
tmp_ret = collect_all('cryptography')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('cffi')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

# Auditoría de peso (reducción ~700MB): estas librerías NO están en
# requirements.txt ni se importan en python/ (la app usa NVIDIA NIM vía HTTP,
# docx2pdf/Word COM, pymupdf y docx). El entorno local las tiene instaladas y
# PyInstaller las arrastra indirectamente. clustering_classifier.py ya es
# Python puro (sin sklearn/numpy) a propósito.
excludes = [
    'torch', 'torchvision', 'torchaudio',
    'transformers', 'sentence_transformers', 'tokenizers', 'tiktoken', 'huggingface_hub',
    'sklearn', 'scipy', 'pandas', 'numpy', 'pyarrow', 'matplotlib', 'contourpy', 'sympy',
    'easyocr', 'crawl4ai', 'altair', 'nltk', 'onnx', 'onnxruntime', 'fasttext', 'spacy',
    'PySide6', 'PyQt5', 'PyQt6', 'IPython', 'ipykernel', 'jupyter_client', 'debugpy',
    'tornado', 'pylab', 'seaborn', 'plotly', 'statsmodels',
]

a = Analysis(
    ['../python/main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='python-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='python-backend',
)
