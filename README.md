```text
██╗██╗██╗  ██╗██████╗  ██████╗  ██████╗  █████╗ ╚██╗██╗
██║██║██║  ██║██╔══██╗██╔═══██╗██╔════╝ ██╔══██╗ ╚██╗██╗
██║██║███████║██████╔╝██║   ██║██║  ███╗███████║  ██║██║
██║██║██╔══██║██╔═══╝ ██║   ██║██║   ██║██╔══██║  ██║██║
██║██║██║  ██║██║     ╚██████╔╝╚██████╔╝██║  ██║██╔╝██║
╚═╝╚═╝╚═╝  ╚═╝╚═╝      ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝ ╚═╝
              W O R D   A P A   7   v 1 . 0
```

<div align="center">

# 📄 WordAPA7 — Formateador Automático Académico a APA 7ª Edición

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-2563EB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-059669?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA_NIM-LLaMA_3.1_70B-76B900?style=for-the-badge&logo=nvidia&logoColor=white)](https://build.nvidia.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-8B5CF6?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Plataforma de alta precisión para transformar documentos universitarios y académicos (<code>.docx</code>) a las normas oficiales APA 7ª Edición manteniendo el 100% del contenido original, diagramación de portada in-place y tablas nativas.</b>
</p>

[📥 Instalación (usuario final)](#-instalación-para-usuario-final) • [✨ Características](#-características-principales) • [🏗 Arquitectura](#-arquitectura-del-sistema) • [🚀 Instalación (desarrollador)](#-instalación-y-ejecución) • [🛡️ Seguridad](#-seguridad-y-variables-de-entorno)

---

</div>

## 📥 Instalación para usuario final

> **No necesitás instalar Python, Node.js ni nada extra.** Todo viaja dentro
> del instalador. Solo descargá el `.exe` y ejecutalo.

### Paso a paso (3 clics + abrir Word)

1. **Descargá** el instalador `WordAPA7 Setup X.X.X.exe` desde la página de
   [Releases en GitHub](https://github.com/WalterSolorzano/ProyectoAPA7/releases).

2. **Hacé doble clic** en el `.exe` descargado.

3. **SmartScreen de Windows** mostrará un aviso azul que dice
   *"Windows protegió tu equipo"*. **Esto es normal** y se debe a que el
   instalador no está firmado con un certificado comercial pago (no queremos
   que los usuarios paguen por usar la herramienta). Para continuar:

   | Paso | Acción |
   |------|--------|
   | 1 | Clic en **"Más información"** |
   | 2 | Clic en **"Ejecutar de todas formas"** |

   > ℹ️ Este aviso aparece **una sola vez** (la primera vez que descargas el
   > instalador). No significa que haya un virus; es el comportamiento estándar
   > de Windows con cualquier instalador descargado de internet que no tiene
   > un certificado de firma de código comercial.

4. **El instalador hace todo solo** (one-click):
   - Copia la aplicación y el complemento de Word.
   - **Registra el complemento automáticamente** en Word (no tenés que hacer
     nada dentro de Word).
   - Agrega la opción "Convertir a APA 7" al clic derecho sobre archivos `.docx`.
   - Configura el arranque automático en segundo plano.
   - Al terminar, **abre la aplicación automáticamente**.

5. **Abrí Microsoft Word.** Vas a ver una nueva pestaña llamada **"WordAPA7"**
   en el ribbon, al lado de las demás pestañas.

   > Si Word ya estaba abierto cuando instalaste, **cerralo y volvé a abrirlo**
   > para que cargue el complemento.

### ¿Qué instala WordAPA7?

| Componente | Ubicación | ¿Requiere admin? |
|------------|-----------|-----------------|
| App de escritorio | `%LOCALAPPDATA%\Programs\WordAPA7\` | No |
| Complemento de Word | `%APPDATA%\WordAPA7\storage\manifest.xml` | No |
| Backend Python embebido | `resources\python-runtime\` (dentro de la app) | No |
| Certificado SSL local | `Cert:\CurrentUser\Root` (auto-firmado, silencioso) | No |
| Entrada de inicio (watcher) | `HKCU\…\Run\WordAPA7Watcher` | No |
| Menú contextual .docx | `HKCU\…\.docx\shell\WordAPA7` | No |

Todo se instala en el **perfil del usuario actual** (HKCU + LOCALAPPDATA),
sin requerir permisos de administrador. Ideal para computadoras de
universidad donde no tenés permisos admin.

### Desinstalación

Desde **Configuración → Aplicaciones → Aplicaciones instaladas**, buscá
"WordAPA7" y clic en Desinstalar. Se eliminan la app, el complemento de Word,
el watcher y el certificado SSL. Tus documentos y claves de IA se conservan
(por si reinstalás).

---

## 🎨 Paleta de Colores y Diseño Oficial (Integración Word 365)

| Componente UI | Código Hexadecimal | Previsualización | Uso |
|---|---|---|---|
| **WordAPA7 Brand Blue** | `#4F7CFF` | `████████` | Color de marca, botones principales, selección |
| **Canvas / Paper White** | `#FFFFFF` | `████████` | Hoja de trabajo, tarjetas elevadas, ribbon |
| **App Surface / Backdrop** | `#F8F9FA` | `████████` | Fondo de la aplicación y paneles |
| **Text Primary (Dark)** | `#0F172A` | `████████` | Tipografía principal de alto contraste |
| **Success Emerald** | `#16A34A` | `████████` | Cumplimiento APA 7, validaciones correctas |
| **Warning Amber** | `#D97706` | `████████` | Advertencias de estilo o citas |
| **Danger Red** | `#DC2626` | `████████` | Errores críticos de formato |

---

## ✨ Características Principales

### ⚡ Normalizador Proactivo In-Document en Microsoft Word (1 Clic)
- **Edición 100% en Vivo**: Muta y formatea directamente el documento abierto en Word (`Word.run`) sin necesidad de exportar ni descargar nuevos archivos `.docx`.
- **Detección Inteligente de Portada**: Identifica y centra la portada de estudiante/profesional sin aplicar sangría de primera línea ni alterar logos universitarios.
- **Jerarquización Automática de Títulos**: Aplica estilos APA 7 a títulos (H1 centrado en negrita, H2 alineado a la izquierda en negrita, H3 cursiva).
- **Tablas y Figuras en Vivo**: Limpia líneas verticales, aplica bordes horizontales 0.5pt e inyecta rótulos reglamentarios `Tabla 1...` y `Figura 1...` con notas al pie.
- **Referencias con Sangría Francesa**: Formatea la sección Referencias al final con *hanging indent* de 1.27 cm e interlineado doble.
- **Señalización en Word (Highlight & Jump)**: Botón *👁️ Ver en Word* que salta al párrafo exacto y lo resalta temporalmente en amarillo.

### 📌 Ribbon Superior Integrado en Word
- Grupo **WordAPA7** en la pestaña **Inicio (Home Tab)** visible inmediatamente al abrir cualquier documento, más la pestaña dedicada **WordAPA7** con todas las herramientas.

### 🛡️ Preservación In-Place de Portadas Universitarias
- **Modificación Quirúrgica XML**: Mantiene intactos agrupamientos de formas `<wpg:wgp>`, cajas de texto `<wps:txbx>`, logos institucionales y encabezados universitarios sin sobreescribirlos ni borrarlos.
- **Roster Arrastrable (Drag & Drop)**: Libreta de integrantes persistente en `localStorage` con autocompletado rápido de autores, carnet, tutor y fecha.

### 📐 Motor de Estilos APA 7º Estricto
- **Normalización Global de Interlineado**: Aplica interlineado **Doble 2.0 (`w:line="480"`)** y `0pt` de espacio antes/después en el 100% de los párrafos del cuerpo.
- **Jerarquía de Títulos (H1 a H5)**: Todos los niveles normalizados a **12pt** (tamaño único del cuerpo). H1 centrado en negrita (`<w:jc w:val="center"/>`), H2/H3 a la izquierda.
- **Tablas Nativas APA 7**: Cero bordes verticales, bordes horizontales de 0.75pt, primera fila de encabezados en negrita obligatoria y título en cursiva.

### 🤖 Clasificación Híbrida Inteligente (NVIDIA NIM)
- **Score Multi-Criterio + Heurística Local**: Resuelve el 85%+ de párrafos instantáneamente sin consumir API Keys.
- **Cola de Lotes NVIDIA NIM (LLaMA 3.1 70B Instruct)**: Procesa secuencialmente en lotes seguros (máx 3,000 tokens) los elementos ambiguos (`needs_review = True`) con reintentos automáticos y caché local por hash SHA-256.
- **Panel de Diagnóstico en Tiempo Real**: Badge interactivo y modal emergente con métricas de latencia, tokens y códigos de respuesta HTTP.

---

## 🏗 Arquitectura del Sistema

```mermaid
graph TD
    A["📄 Documento .docx Original"] --> B["🐍 Python FastAPI Backend"]
    B --> C["🔍 structure_scanner.py (lxml XML)"]
    C --> D["⚡ pre_classifier.py (Pass 1 - Pass 3)"]
    
    D -->|Confiabilidad >= 90%| E["✅ Asignación Directa"]
    D -->|Ambiguo 40%-70%| F["🤖 llm_batch_classifier.py"]
    
    F -->|Lotes <= 3000 tokens| G["🌐 NVIDIA NIM API (LLaMA 3.1 70B)"]
    G --> H["💾 Local Hash Cache (SHA-256)"]
    
    E --> I["🎨 style_engine.py / table_engine.py"]
    H --> I
    
    I --> J["🛡️ sanity_check.py (Gate de Sanidad)"]
    J --> K["📥 DOCX Formateado APA 7 Final"]
```

---

## 🚀 Instalación y Ejecución (Desarrollador)

### Requisitos Previos
- **Python**: 3.11 o superior
- **Node.js**: v18.0.0 o superior
- **Git**

### 1. Clonar el Repositorio
```bash
git clone https://github.com/WalterSolorzano/ProyectoAPA7.git
cd ProyectoAPA7
```

### 2. Setup Automático (recomendado)
```bash
setup.bat
```

`setup.bat` hace todo en un solo paso:
- Verifica Python 3.11+ y Node.js 18+ en el PATH.
- Crea el entorno virtual `venv\` e instala `requirements.txt` en él.
- Copia `.env.example` → `.env` (solo si no existe) y restringe su acceso al usuario actual.
- `npm install` + genera la plantilla APA7 + `npm run build`.

### 3. Iniciar la Aplicación
```bash
start.bat
```
(o `powershell -ExecutionPolicy Bypass -File start.ps1`). El arranque usa
`venv\Scripts\python.exe` si existe. Abre en tu navegador: **`http://localhost:8742`**

### 4. Setup Manual (alternativa)
```bash
# Entorno virtual + dependencias
python -m venv venv
venv\Scripts\pip install -r requirements.txt
npm install
venv\Scripts\python python\create_template.py
npm run build
```

### 5. Configurar Variables de Entorno
Copia el archivo `.env.example` a `.env` si `setup.bat` no lo hizo:
```bash
cp .env.example .env
```
Edita `.env` con tu API Key opcional de NVIDIA NIM:
```env
NVIDIA_API_KEY=nvapi-TU_CLAVE_AQUI
NVIDIA_NIM_MODEL=meta/llama-3.1-70b-instruct
```

### 6. Generar el Instalador (Electron)
```bash
# 1. Construir el backend Python embebido
npm run build:backend

# 2. Construir el frontend + add-in de Word
npm run build

# 3. Empaquetar con electron-builder (genera dist-electron-builder/WordAPA7 Setup X.X.X.exe)
npx electron-builder --win
```

El instalador resultante es un `.exe` one-click que:
- No requiere permisos de administrador (instala en `%LOCALAPPDATA%`).
- Registra el complemento de Word automáticamente (sideload vía `Wef\Developer`).
- Instala el certificado SSL autofirmado silenciosamente al arrancar el backend.
- Muestra el aviso de SmartScreen (inevitable sin certificado comercial).

## 🔐 Seguridad de Claves de API

- **No se empaquetan claves en el instalador.** `electron-builder.yml` usa
  empaquetado *whitelist*: solo `dist/**`, `dist-electron/**` y
  `dist-python/**` (bundle PyInstaller que incluye únicamente
  `python/assets/`). `.env`, `.env.example`, `storage/` y `requirements.txt`
  NUNCA se incluyen en `electron:build`.
- **`.env.example` solo contiene placeholders.** `setup.bat` verifica que no
  haya claves reales (patrón `nvapi-`/`sk-`/`gsk_`/`csk-`) y aborta si las
  encuentra, para evitar distribuir una clave real por accidente.
- **`.env` está en `.gitignore`** y `setup.bat` le aplica ACL de Windows para
  restringirlo al usuario actual. Nunca lo subas a git ni lo compartas.
- Las claves que escribes en la UI se conservan en `storage/ai_keys.json`
  (carpeta local, también gitignore) y se restauran en `os.environ` al iniciar.
  Es cifrado en reposo no aplicado: las claves están en texto plano en tu disco
  local, como es típico en apps de escritorio. No compartas la carpeta del
  proyecto ni hagas backups que la incluyan.

### Claves embebidas en el instalador (ofuscadas)

Para que la IA funcione **sin configuración** en el instalador, las claves de
los 10 proveedores se empaquetan dentro del instalador de forma **ofuscada**
(XOR + base64 con semilla compartida), generadas por `python/embed_payload.py`
desde tu `.env` local en cada `npm run build:backend`:

1. El build lee tu `.env` (local, gitignoreado) y escribe
   `python/_embedded_payload.json` (gitignoreado, nunca se sube a git).
2. PyInstaller lo incluye como data en `_internal/_embedded_payload.json`.
3. En runtime, `python/embedded_secrets.py` lo decodifica y lo inyecta en
   `os.environ` **solo si la variable aún no está definida** (prioridad:
   entorno del launcher > claves del usuario en `ai_keys.json` > embebidas).

**Verificado**: ningún fragmento de 10+ caracteres de las claves reales aparece
en el instalador (`WordAPA7 Setup *.exe`), `app.asar` ni el backend empaquetado.

> ⚠️ **Límite honesto**: esto es *ofuscación*, no cifrado real. Cualquier
> proceso que pueda *usar* la clave también puede *extraerla* (depurar la app o
> volcar su memoria/entorno). Solo eleva la barrera contra extracción casual
> (strings, grep, escaneo binario). **No distribuyas este instalador
> públicamente**: todos los usuarios compartirían las mismas claves y cuota, y
> los proveedores pueden bloquearlas. Para distribución pública, la solución
> real es un proxy server-side (las claves nunca tocan el cliente).

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con un suite automatizado de 146 pruebas unitarias e integración:

```bash
# Ejecutar suite de pruebas pytest
pytest python/tests

# Validar build de producción frontend React
npm run build
```

---

## 🛡️ Seguridad y Buenas Prácticas

- 🔒 **Sin Fuga de Credenciales**: `.gitignore` excluye strictly `.env`, archivos de sesión en `storage/` y archivos `.docx` temporales.
- ⚡ **Gate de Sanidad**: El pipeline mide la retención de caracteres pre/post exportación y bloquea descargas si se detecta una pérdida superior al 5%.

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
