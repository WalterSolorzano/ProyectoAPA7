; WordAPA7 — Branding del instalador (coincide con el diseño de la app)
; Se incluye en el header del script NSIS generado por electron-builder,
; ANTES del template principal, por lo que puede definir macros y defines
; de MUI2 (welcome/finish/colores) que el resto del script consume.

; ── One-click: mínima fricción (oneClick: true en electron-builder.yml) ────
; Con oneClick: true, electron-builder NO muestra página de bienvenida ni
; de elección de carpeta. El instalador muestra una sola barra de progreso,
; se instala en %LOCALAPPDATA%\Programs\WordAPA7\ (sin UAC) y al terminar
; muestra la página de finalización (MUI_FINISHPAGE) con el checkbox de
; "Abrir WordAPA7" (runAfterFinish: true).
;
; La macro customWelcomePage se conserva por compatibilidad: si en el futuro
; se vuelve a oneClick: false, las páginas de bienvenida con branding se
; muestran automáticamente. Con oneClick: true, electron-builder no llama
; a esta macro y las defines son simplemente ignoradas (inofensivas).

; ── Instalación por usuario (sin UAC) ──────────────────────────────────────
; perMachine: false en electron-builder.yml instala en
; $LOCALAPPDATA\Programs\WordAPA7\ sin pedir permisos de administrador.
; Todas las claves de registro deben ir en HKCU (no HKLM) para mantener
; esta propiedad. Esto es crítico para estudiantes que no tienen permisos
; admin en las computadoras de su universidad.

; ── Textos en español (misma voz que la app) ──────────────────────────────
; IMPORTANTE: el instalador es Unicode (NSIS Unicode por defecto en
; electron-builder), por lo que los caracteres acentuados, flechas (→) y
; comillas angulares («») se muestran correctamente.
;
; Las defines de WELCOME se conservan para el modo oneClick: false.
; Con oneClick: true solo se muestra la página de finalización (FINISHPAGE).

!define MUI_WELCOMEPAGE_TITLE "Bienvenido a WordAPA7 (Impulsada por IA)"
!define MUI_WELCOMEPAGE_TEXT "WordAPA7 es una herramienta inteligente que convierte tus documentos de Word (.docx) al formato APA 7.$\r$\n$\r$\nEste asistente instalará DOS componentes en tu sistema:$\r$\n$\r$\n1. La aplicación de escritorio de WordAPA7 (Impulsada por IA): revisa títulos, figuras, tablas y referencias de tus documentos.$\r$\n$\r$\n2. El complemento oficial (Add-in) para Microsoft Word: permite formatear y auditar citas directamente desde Word, sin salir del documento.$\r$\n$\r$\nDurante la instalación se realizarán automáticamente los siguientes pasos (no tenés que configurar nada del complemento a mano):$\r$\n   - Se copiarán los archivos de la aplicación y del complemento.$\r$\n   - Se registrará el complemento en Word (aparecerá como pestaña «WordAPA7» al abrir Word).$\r$\n   - Se agregará la opción «Convertir a APA 7» al hacer clic derecho sobre un archivo .docx.$\r$\n   - Se configurará el inicio automático del backend para que funcione en segundo plano.$\r$\n$\r$\nSe recomienda cerrar Microsoft Word y demás aplicaciones antes de continuar."

; ── Página de finalización (única página visible con oneClick: true) ──────
; Este es el ÚNICO texto que el usuario ve durante la instalación one-click.
; Explica que el complemento ya está instalado y qué hacer con Word.
!define MUI_FINISHPAGE_TITLE "¡WordAPA7 instalado correctamente!"
!define MUI_FINISHPAGE_TEXT "La aplicación de escritorio y el complemento de Word quedaron instalados.$\r$\n$\r$\nAl presionar Terminar, WordAPA7 se abrirá automáticamente. La primera vez puede tardar entre 10 y 20 segundos mientras el backend se inicializa (es normal; esperá unos instantes).$\r$\n$\r$\nSobre el complemento de Word:$\r$\n   ✓ El complemento queda registrado y el catálogo confiable creado automáticamente.$\r$\n   ✓ Si no aparece solo: Insertar → Mis complementos → CARPETA COMPARTIDA → WordAPA7 → Agregar.$\r$\n   ✓ Si Word estaba abierto, cerralo y volvé a abrirlo para que cargue el complemento.$\r$\n   ✓ El certificado de seguridad se instala automáticamente (sin ventanas emergentes).$\r$\n$\r$\nPresioná Terminar para abrir la aplicación."

!define MUI_ABORTWARNING_TEXT "¿Seguro que querés cancelar la instalación de WordAPA7?"

!define MUI_UNWELCOMEPAGE_TITLE "Desinstalar WordAPA7"
!define MUI_UNWELCOMEPAGE_TEXT "Estás por desinstalar WordAPA7 de tu sistema (incluyendo la aplicación de escritorio y el complemento de Word).$\r$\n$\r$\nTus documentos originales no se modifican; solo se elimina la aplicación y su complemento."

; ── Identidad visual (accent #4f7cff, tokens de design-tokens.md) ─────────
BrandingText "WordAPA7 · Formato APA 7 automático · Impulsada por IA"

; Fondo de las páginas en tono azul claro de marca (nada de blanco plano) con
; texto en azul marino de alto contraste.
!define MUI_BGCOLOR "DEE7FF"
!define MUI_TEXTCOLOR "14213D"

; Barra de progreso de la instalación en azul de marca
!define MUI_INSTFILESPAGE_COLORS "14213d 4f7cff"
!define MUI_INSTFILESPAGE_PROGRESSBAR "colored"

; Página de bienvenida con la sidebar de marca
; (solo se muestra si oneClick: false; con oneClick: true no se llama)
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ── Context Menu, Watcher y Registro de Add-in ─────────────────────────────
; Registra una entrada en el menú contextual de Windows para archivos .docx.
; Registra el Watcher ligero (python.exe main.py --watcher) en el inicio de
; Windows para que el backend arranque automáticamente cuando se abre Word.
; Adicionalmente, registra el manifiesto del Add-in en la clave de desarrollo
; de Office para auto-sideload sin intervención manual del usuario.
;
; IMPORTANTE: usamos HKCU (no HKLM) porque la instalación es por usuario
; (perMachine: false). HKCU no requiere permisos de administrador.
;
; ARQUITECTURA: El backend Python viaja como distribución embebida oficial
; (python.exe firmado por Python Software Foundation) en resources/python-runtime/.
; Esto reemplaza al anterior python-backend.exe (PyInstaller) que Windows
; Defender flaggeaba como malware. El watcher se ejecuta como:
;   python.exe main.py --watcher
; usando el python.exe oficial que Defender confía por defecto.
;
; NOTA DE SEGURIDAD: NO se inicia el watcher durante la instalación.
; Anteriormente se usaba nsExec::Exec para arrancar el binario durante el
; install, pero esto disparaba alertas de Windows Defender (comportamiento
; típico de malware: ejecutar binarios durante la instalación). En su lugar,
; el watcher se arranca de dos formas:
;   1. runAfterFinish: true → la app Electron se abre al terminar la
;      instalación, y main.ts llama a startWatcherNow() automáticamente.
;   2. La clave Run de Windows arranca el watcher en el próximo inicio
;      de sesión, garantizando que funcione sin abrir la app manualmente.
; ── customInit: cerrar instancias previas para evitar bloqueos de archivos ─
!macro customInit
  nsExec::Exec 'cmd /c taskkill /IM WordAPA7.exe /T /F >nul 2>nul || exit 0'
  Pop $0
  nsExec::Exec `wmic process where "name='python.exe' and CommandLine like '%python-runtime%'" call terminate`
  Pop $0
!macroend

!macro customInstall
  ; ── Detectar si Microsoft Word está abierto ──────────────────────────────
  ; Si Word está abierto durante la instalación, el complemento se registrará
  ; en Office pero Word NO lo cargará hasta que se reinicie. Esto es la causa
  ; #1 de "instalé el complemento pero no aparece en Word". Detectamos WINWORD
  ; y ofrecemos cerrarlo (cierre graceful: Word puede pedir guardar cambios).
  ;
  ; Usamos tasklist + find (binarios firmados de Windows, no disparan
  ; alertas de Defender a diferencia de lanzar el exe propio del paquete).
  nsExec::Exec 'cmd /c tasklist /FI "IMAGENAME eq WINWORD.EXE" /NH | find /i "WINWORD.EXE" >nul && exit 1 || exit 0'
  Pop $0
  StrCmpS $0 "1" 0 word_check_done
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Microsoft Word está abierto.$\r$\n$\r$\nPara que el complemento WordAPA7 aparezca en Word, es necesario cerrar Word y volver a abrirlo después de la instalación.$\r$\n$\r$\n¿Querés que lo cerremos ahora? (Word te pedirá guardar los cambios sin guardar)" IDNO word_check_done
    ; Cierre graceful (sin /F): Word puede mostrar el diálogo "guardar cambios".
    nsExec::Exec 'taskkill /IM WINWORD.EXE'
    Pop $0
    ; Dar un momento a Word para que cierre
    Sleep 1500
  word_check_done:

  ; ── Context Menu: click derecho → "Convertir a APA 7" ──────────────────
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7" "" "Convertir a APA 7 con WordAPA7"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7" "Icon" "$INSTDIR\WordAPA7.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7\command" "" '"$INSTDIR\WordAPA7.exe" "%1"'

  ; Crear el directorio de almacenamiento si no existe
  CreateDirectory "$APPDATA\WordAPA7\storage"

  ; Copiar el manifiesto de plantilla para que Word lo encuentre al arrancar
  CopyFiles "$INSTDIR\resources\addin\manifest.xml" "$APPDATA\WordAPA7\storage\manifest.xml"

  ; Registro del Add-in en Word (mecanismo oficial de auto-sideload de Office)
  ; Esta clave hace que Word cargue el Add-in automáticamente al iniciar,
  ; sin que el usuario tenga que ir a Insertar > Mis complementos > Agregar.
  WriteRegStr HKCU "Software\Microsoft\Office\16.0\Wef\Developer" "WordAPA7" "$APPDATA\WordAPA7\storage\manifest.xml"

  ; ── Watcher ligero en el inicio de Windows ─────────────────────────────
  ; El watcher es un proceso de bajísimo consumo (~8MB RAM) que:
  ;   1. Se inicia al iniciar sesión en Windows
  ;   2. Detecta cuando se abre Microsoft Word
  ;   3. Arranca el backend Python automáticamente
  ;   4. Lo detiene cuando se cierra Word (ahorra recursos)
  ; Usa python.exe (oficial, firmado por PSF) con main.py --watcher.
  ; El usuario NO tiene que abrir la app Electron ni ejecutar nada manualmente.
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WordAPA7Watcher" '"$INSTDIR\resources\python-runtime\python.exe" "$INSTDIR\resources\python-runtime\python\main.py" --watcher'

  ; ── Watcher: NO se arranca durante la instalación ─────────────────────
  ; El watcher se arrancará automáticamente cuando:
  ;   1. La app Electron se abra (runAfterFinish: true) → main.ts llama a
  ;      startWatcherNow() que lo arranca en background.
  ;   2. El usuario inicie sesión en Windows (clave Run registrada arriba).
  ;
  ; Versiones anteriores usaban nsExec::Exec aquí para arrancar el watcher
  ; inmediatamente, pero esto causaba falsos positivos de Windows Defender
  ; porque ejecutar un binario no firmado durante la instalación es un
  ; patrón de comportamiento típico de malware. Se remueve por seguridad.
  DetailPrint "Watcher registrado para el inicio de sesión (se activará al abrir la app)"
; Click derecho sobre .docx -> Convertir a APA 7 (ventana compacta)
  ; IMPORTANTE: HKCU\Software\Classes (NO HKCR) — instalación per-user sin UAC.
  ; Escribir a HKCR requeriría admin y fallaría silencioso para estudiantes.
WriteRegStr HKCU "Software\Classes\Word.Document.12\shell\WordAPA7Convert" "" "Convertir a APA 7"
WriteRegStr HKCU "Software\Classes\Word.Document.12\shell\WordAPA7Convert" "Icon" "$INSTDIR\WordAPA7.exe"
WriteRegStr HKCU "Software\Classes\Word.Document.12\shell\WordAPA7Convert" "Position" "Top"
WriteRegStr HKCU "Software\Classes\Word.Document.12\shell\WordAPA7Convert\command" "" '"$INSTDIR\WordAPA7.exe" --quick "%1"'

  ; ── Catálogo confiable del complemento, listo ANTES del primer arranque ──
  ; Copia del manifest + clave TrustedCatalogs para que Word lo liste en
  ; Insertar → Mis complementos → CARPETA COMPARTIDA sin abrir la app antes.
CreateDirectory "$LOCALAPPDATA\WordAPA7\addin-catalog"
CopyFiles /SILENT "$INSTDIR\resources\addin\manifest.xml" "$LOCALAPPDATA\WordAPA7\addin-catalog\manifest.xml"
WriteRegStr HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{B7A2F3D1-5C4E-4E8A-9A21-0C0FFEED}" "Url" "$LOCALAPPDATA\WordAPA7\addin-catalog"
WriteRegStr HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{B7A2F3D1-5C4E-4E8A-9A21-0C0FFEED}" "Id" "{B7A2F3D1-5C4E-4E8A-9A21-0C0FFEED}"
WriteRegDWORD HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{B7A2F3D1-5C4E-4E8A-9A21-0C0FFEED}" "Flags" 1
DetailPrint "Complemento de Word: catálogo confiable registrado"
!macroend

!macro customUnInstall
  ; ── Detener el watcher y el backend antes de desinstalar ──────────────
  ; Matar los procesos python.exe que pertenecen a WordAPA7 (watcher + backend).
  ; No podemos usar taskkill /IM python.exe porque mataría otros procesos
  ; Python del usuario que no tienen nada que ver con WordAPA7.
  ; Usamos wmic para encontrar procesos por línea de comandos (más selectivo).
  ; wmic está deprecado en Win11 pero sigue funcionando; el fallback con
  ; PowerShell Get-CimMethod cubre versiones futuras.
  nsExec::Exec /TIMEOUT=5000 `wmic process where "name='python.exe' and CommandLine like '%python-runtime%'" call terminate`
  Pop $0
  ; Fallback: PowerShell (para versiones futuras de Windows sin wmic)
  nsExec::Exec /TIMEOUT=8000 `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter 'Name=python.exe' | Where-Object CommandLine -match 'python-runtime' | Invoke-CimMethod -MethodName Terminate"`
  Pop $0

  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7"
  ; Verbos contextuales propios (click derecho) — en HKCU\Classes (como se crearon)
  DeleteRegKey HKCU "Software\Classes\Word.Document.12\shell\WordAPA7Convert"
  DeleteRegKey HKCU "Software\Classes\Word.Document.8\shell\WordAPA7Convert"
  ; Limpieza de restos legacy (versiones <=1.0.48 escribían a HKCR)
  DeleteRegKey HKCR "Word.Document.12\shell\WordAPA7Convert"
  DeleteRegKey HKCR "Word.Document.8\shell\WordAPA7Convert"
  ; Catalogo confiable del add-in
  DeleteRegKey HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{B7A2F3D1-5C4E-4E8A-9A21-0C0FFEED}"
  RMDir /r "$LOCALAPPDATA\WordAPA7\addin-catalog"
  
  ; Limpiar el registro del Add-in en Word al desinstalar
  DeleteRegValue HKCU "Software\Microsoft\Office\16.0\Wef\Developer" "WordAPA7"
  DeleteRegValue HKCU "Software\Microsoft\Office\16.0\Wef\Developer" "{56D02414-D45C-456C-A180-9123FBFA206D}"
  DeleteRegValue HKCU "Software\Microsoft\Office\16.0\Wef\Developer" "{8F3A2C1D-9B4E-4A7F-8C5D-2E1F0A3B6C9D}"

  ; ── Purga de caché web de complementos (Wef) ──────────────────────────
  ; Es SOLO caché (bug conocido office-js#6009): borrarla evita que Word
  ; muestre un complemento fantasma tras desinstalar.
  RMDir /r "$LOCALAPPDATA\Microsoft\Office\16.0\Wef"
  Delete "$LOCALAPPDATA\Microsoft\Office\16.0\.wordapa7_wef_purged_2026_08"
  Delete "$LOCALAPPDATA\Microsoft\Office\16.0\.wef_purge_marker"

  ; Eliminar el watcher del inicio de Windows
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WordAPA7Watcher"

  ; ── Limpiar archivos del Add-in (manifiesto + catálogo compartido) ────
  ; El manifiesto principal registrado en Office:
  Delete "$APPDATA\WordAPA7\storage\manifest.xml"

  ; El catálogo compartido (fallback usado por register_addin.ps1 / auto-setup).
  ; Si no se borra, queda una referencia a un manifiesto inexistente y Word
  ; puede mostrar un error al listar complementos de carpeta compartida.
  Delete "$APPDATA\WordAPA7\catalog\manifest.xml"
  RMDir "$APPDATA\WordAPA7\catalog"

  ; ── Best-effort: eliminar el certificado SSL auto-firmado del Trusted Root ──
  ; El backend instala un certificado raíz auto-firmado (CN=localhost, O=WordAPA7)
  ; en el Trusted Root del usuario actual para que Word/WebView2 confíe en
  ; https://localhost:8742. Al desinstalar lo quitamos para no dejar trusts
  ; residuales. Es best-effort: si falla (PowerShell no disponible, etc.) no
  ; se aborta la desinstalación — el cert solo confía en localhost, bajo riesgo.
  ;
  ; NOTA de quoting NSIS: usamos backticks (``) como delimitadores para poder
  ; incluir comillas dobles y simples dentro del comando de PowerShell sin
  ; escapado. Ademas usamos la sintaxis simplificada de Where-Object
  ; ("Where-Object Subject -match 'WordAPA7'") en lugar de "{ $_.Subject }"
  ; porque NSIS expande "$_" dentro de strings (lo vaciaria y romperia el
  ; comando). Esta sintaxis funciona en PowerShell 3.0+ (Win8+/2012+).
  nsExec::Exec /TIMEOUT=8000 `powershell -NoProfile -NonInteractive -Command "Get-ChildItem Cert:\CurrentUser\Root | Where-Object Subject -match 'WordAPA7' | Remove-Item -Force -ErrorAction SilentlyContinue"`
  Pop $0

  ; ── Limpiar los archivos de certificado SSL del disco ─────────────────
  Delete "$APPDATA\WordAPA7\storage\ssl\localhost.pem"
  Delete "$APPDATA\WordAPA7\storage\ssl\localhost-key.pem"
  RMDir "$APPDATA\WordAPA7\storage\ssl"

  ; NOTA: NO borramos $APPDATA\WordAPA7\storage\sessions ni ai_keys.json
  ; deliberadamente: si el usuario reinstala, conserva sus documentos
  ; procesados y sus claves de IA. Solo se eliminan los artefactos del
  ; complemento (manifiesto, catálogo, certificados).

  DetailPrint "Complemento de Word, watcher y certificado SSL eliminados"
!macroend

