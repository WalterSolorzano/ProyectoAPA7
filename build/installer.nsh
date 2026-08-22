; WordAPA7 — Branding del instalador (coincide con el diseño de la app)
; Se incluye en el header del script NSIS generado por electron-builder,
; ANTES del template principal, por lo que puede definir macros y defines
; de MUI2 (welcome/finish/colores) que el resto del script consume.

; ── Instalación por usuario (sin UAC) ──────────────────────────────────────
; perMachine: false en electron-builder.yml instala en
; $LOCALAPPDATA\Programs\WordAPA7\ sin pedir permisos de administrador.
; Todas las claves de registro deben ir en HKCU (no HKLM) para mantener
; esta propiedad. Esto es crítico para estudiantes que no tienen permisos
; admin en las computadoras de su universidad.

; ── Textos en español (misma voz que la app) ──────────────────────────────
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a WordAPA7 (Impulsada por IA)"
!define MUI_WELCOMEPAGE_TEXT "WordAPA7 es una herramienta inteligente que convierte tus documentos de Word (.docx) al formato APA 7.$\r$\n$\r$\nEste asistente configurará automáticamente en tu sistema:$\r$\n1. La aplicación de escritorio de WordAPA7 (Impulsada por IA) para revisar títulos, figuras, tablas y referencias.$\r$\n2. El complemento oficial (Add-in) para Microsoft Word, permitiendo formatear y auditar citas directamente desde Word.$\r$\n$\r$\nSe recomienda cerrar Microsoft Word y demás aplicaciones antes de continuar."

!define MUI_FINISHPAGE_TITLE "Instalación completada"
!define MUI_FINISHPAGE_TEXT "WordAPA7 y el complemento para Microsoft Word (Impulsada por IA) quedaron instalados correctamente y listos para usar.$\r$\n$\r$\nPresioná Terminar para abrir la aplicación."

!define MUI_ABORTWARNING_TEXT "¿Seguro que querés cancelar la instalación de WordAPA7?"

!define MUI_UNWELCOMEPAGE_TITLE "Desinstalar WordAPA7"
!define MUI_UNWELCOMEPAGE_TEXT "Estás por desinstalar WordAPA7 de tu sistema (incluyendo el complemento de Word).$\\r$\\n$\\r$\\nTus documentos originales no se modifican; solo se elimina la aplicación."

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
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ── Context Menu y Registro de Add-in en Microsoft Word ─────────────────────
; Registra una entrada en el menú contextual de Windows para archivos .docx.
; Adicionalmente, registra el manifiesto dinámico del Add-in de Microsoft Word en la
; clave de desarrollo de Office para auto-sideload sin intervención manual del usuario.
;
; IMPORTANTE: usamos HKCU (no HKLM) porque la instalación es por usuario
; (perMachine: false). HKCU no requiere permisos de administrador.
!macro customInstall
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7" "" "Convertir a APA 7 con WordAPA7"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7" "Icon" "$INSTDIR\WordAPA7.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7\command" "" '"$INSTDIR\WordAPA7.exe" "%1"'

  ; Crear el directorio de almacenamiento si no existe
  CreateDirectory "$APPDATA\WordAPA7\storage"

  ; Copiar el manifiesto de plantilla para que Word lo encuentre al arrancar
  CopyFiles "$INSTDIR\resources\addin\manifest.xml" "$APPDATA\WordAPA7\storage\manifest.xml"

  ; Registro del Add-in en Word (mecanismo oficial de auto-sideload de Office en HKCU apuntando al archivo local)
  WriteRegStr HKCU "Software\Microsoft\Office\16.0\Wef\Developer" "WordAPA7" "$APPDATA\WordAPA7\storage\manifest.xml"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7"
  
  ; Limpiar el registro del Add-in en Word al desinstalar
  DeleteRegValue HKCU "Software\Microsoft\Office\16.0\Wef\Developer" "WordAPA7"

  ; Eliminar el manifiesto de almacenamiento
  Delete "$APPDATA\WordAPA7\storage\manifest.xml"
!macroend
