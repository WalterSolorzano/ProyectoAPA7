; WordAPA7 — Branding del instalador (coincide con el diseño de la app)
; Se incluye en el header del script NSIS generado por electron-builder,
; ANTES del template principal, por lo que puede definir macros y defines
; de MUI2 (welcome/finish/colores) que el resto del script consume.

; ── Textos en español (misma voz que la app) ──────────────────────────────
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a WordAPA7"
!define MUI_WELCOMEPAGE_TEXT "WordAPA7 convierte tus documentos de Word (.docx) al formato APA 7.$\r$\n$\r$\nVas a poder revisar títulos, figuras, tablas y referencias antes de exportar el documento final.$\r$\n$\r$\nSe recomienda cerrar las demás aplicaciones antes de continuar."

!define MUI_FINISHPAGE_TITLE "Instalación de WordAPA7 completada"
!define MUI_FINISHPAGE_TEXT "WordAPA7 quedó instalado correctamente.$\r$\n$\r$\nPresioná Terminar para abrir la aplicación."

!define MUI_ABORTWARNING_TEXT "¿Seguro que querés cancelar la instalación de WordAPA7?"

!define MUI_UNWELCOMEPAGE_TITLE "Desinstalar WordAPA7"
!define MUI_UNWELCOMEPAGE_TEXT "Estás por desinstalar WordAPA7.$\r$\n$\r$\nTus documentos originales no se modifican; solo se elimina la aplicación."

; ── Identidad visual (accent #4f7cff, tokens de design-tokens.md) ─────────
BrandingText "WordAPA7 · Formato APA 7 al instante"

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

; ── Context Menu: "Convertir a APA 7" en click derecho sobre .docx ──────────
; Registra una entrada en el menú contextual de Windows para archivos .docx.
; Al hacer click derecho sobre un .docx → "Convertir a APA 7 con WordAPA7"
; → abre la app con el archivo como argumento, que se procesa automáticamente.
; Usamos SystemFileAssociations para no interferir con la asociación propia
; de Word (Word.Document.12).
!macro customInstall
  WriteRegStr HKLM "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7" "" "Convertir a APA 7 con WordAPA7"
  WriteRegStr HKLM "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7" "Icon" "$INSTDIR\WordAPA7.exe"
  WriteRegStr HKLM "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7\command" "" '"$INSTDIR\WordAPA7.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKLM "Software\Classes\SystemFileAssociations\.docx\shell\WordAPA7"
!macroend
