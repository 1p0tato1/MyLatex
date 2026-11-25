#!/usr/bin/env python3
"""Génère src/lang/{en,fr,es,de}.json depuis ce tableau (source de vérité des traductions).
Ajouter une langue: ajouter son code dans LANGS (+ une colonne à chaque ligne), l'ajouter dans src/i18n.js (LANGS) et dans le menu Rust.
Le guide se traduit à part: src/guide.<code>.html (repli sur guide.en.html)."""
import json, os
LANGS = ["en", "fr", "es", "de"]
T = """
ui.outlineToggle|Show/hide the outline (⌥⌘O)|Afficher/masquer le plan (⌥⌘O)|Mostrar/ocultar el esquema (⌥⌘O)|Gliederung ein-/ausblenden (⌥⌘O)
ui.newTitle|New (⌘N)|Nouveau (⌘N)|Nuevo (⌘N)|Neu (⌘N)
ui.autosave|Auto-save|Enreg. auto|Autoguardado|Autospeichern
ui.autosaveTip|Auto-save: files that already have a name are saved by themselves about a second after you stop typing|Enregistrement automatique : les fichiers déjà nommés sont enregistrés environ une seconde après que vous arrêtez de taper|Autoguardado: los archivos que ya tienen nombre se guardan solos un segundo después de dejar de escribir|Automatisch speichern: benannte Dateien werden etwa eine Sekunde nach dem Tippen gesichert
ui.autocompile|Autocompile|Compil. auto|Autocompilar|Autokompilieren
ui.autocompileTip|Autocompile: the PDF refreshes by itself shortly after you stop typing|Compilation automatique : le PDF se met à jour tout seul peu après que vous arrêtez de taper|Autocompilar: el PDF se actualiza solo poco después de dejar de escribir|Automatisch kompilieren: das PDF aktualisiert sich kurz nach dem Tippen
ui.code|Code|Code|Código|Code
ui.codeTip|Edit the LaTeX source|Modifier le source LaTeX|Editar el código LaTeX|LaTeX-Quelltext bearbeiten
ui.visual|Visual|Visuel|Visual|Visuell
ui.visualTip|Visual editor: formatted text and rendered math (⌥⌘V)|Éditeur visuel : texte mis en forme et maths rendues (⌥⌘V)|Editor visual: texto con formato y matemáticas renderizadas (⌥⌘V)|Visueller Editor: formatierter Text und gesetzte Formeln (⌥⌘V)
ui.compile|Compile|Compiler|Compilar|Kompilieren
ui.compileTip|Compile (⌘↵)|Compiler (⌘↵)|Compilar (⌘↵)|Kompilieren (⌘↵)
ui.outline|Outline|Plan|Esquema|Gliederung
ui.dragResize|Drag to resize|Glisser pour redimensionner|Arrastrar para cambiar el tamaño|Zum Ändern der Größe ziehen
ui.bold|Bold (⌘B)|Gras (⌘B)|Negrita (⌘B)|Fett (⌘B)
ui.italic|Italic (⌘I)|Italique (⌘I)|Cursiva (⌘I)|Kursiv (⌘I)
ui.underline|Underline (⌘U)|Souligné (⌘U)|Subrayado (⌘U)|Unterstrichen (⌘U)
ui.headingTip|Turn the current line into a heading|Transformer la ligne en titre|Convertir la línea en título|Zeile in Überschrift umwandeln
ui.normalText|Normal text|Texte normal|Texto normal|Normaler Text
ui.section|Section|Section|Sección|Abschnitt
ui.subsection|Subsection|Sous-section|Subsección|Unterabschnitt
ui.subsubsection|Subsubsection|Sous-sous-section|Subsubsección|Unter-Unterabschnitt
ui.paragraph|Paragraph|Paragraphe|Párrafo|Absatz
ui.listBullet|• List|• Liste|• Lista|• Liste
ui.listBulletTip|Bullet list|Liste à puces|Lista con viñetas|Aufzählung
ui.listNum|1. List|1. Liste|1. Lista|1. Liste
ui.listNumTip|Numbered list|Liste numérotée|Lista numerada|Nummerierte Liste
ui.inline|∑ Inline|∑ En ligne|∑ En línea|∑ Inline
ui.inlineTip|Inline math  $…$|Maths en ligne  $…$|Matemáticas en línea  $…$|Inline-Formel  $…$
ui.display|∑ Display|∑ Hors-texte|∑ Destacada|∑ Abgesetzt
ui.displayTip|Display math  \\[ … \\]|Maths hors-texte  \\[ … \\]|Matemáticas destacadas  \\[ … \\]|Abgesetzte Formel  \\[ … \\]
ui.cite|Cite|Citer|Citar|Zitat
ui.citeTip|Insert \\cite{…}|Insérer \\cite{…}|Insertar \\cite{…}|\\cite{…} einfügen
ui.ref|Ref|Réf.|Ref.|Verw.
ui.refTip|Insert \\ref{…}|Insérer \\ref{…}|Insertar \\ref{…}|\\ref{…} einfügen
ui.image|Image|Image|Imagen|Bild
ui.imageTip|Insert an image (or drop one onto the editor)|Insérer une image (ou la déposer sur l'éditeur)|Insertar una imagen (o soltarla en el editor)|Bild einfügen (oder auf den Editor ziehen)
ui.spellLangTip|Spelling language: automatic (from the document) or fixed|Langue du correcteur : automatique (d'après le document) ou fixe|Idioma del corrector: automático (según el documento) o fijo|Sprache der Prüfung: automatisch (nach Dokument) oder fest
ui.langAuto|Auto|Auto|Auto|Auto
ui.spellTip|Spell check: misspelled words are underlined in red. Right-click one for suggestions.|Correcteur : les mots mal orthographiés sont soulignés en rouge. Clic droit pour des suggestions.|Corrector: las palabras mal escritas se subrayan en rojo. Clic derecho para sugerencias.|Rechtschreibprüfung: falsch geschriebene Wörter werden rot unterstrichen. Rechtsklick für Vorschläge.
ui.spelling|Spelling|Orthographe|Ortografía|Rechtschr.
ui.zoomOut|Zoom out (⌘ + scroll / pinch)|Zoom arrière (⌘ + molette / pincement)|Alejar (⌘ + rueda / pellizco)|Verkleinern (⌘ + Scrollen / Pinch)
ui.zoomReset|Reset zoom|Réinitialiser le zoom|Restablecer zoom|Zoom zurücksetzen
ui.zoomIn|Zoom in|Zoom avant|Acercar|Vergrößern
ui.showInPdf|Show in PDF|Voir dans le PDF|Ver en el PDF|Im PDF zeigen
ui.showInPdfTip|Show the word at the cursor in the PDF (⌘J, or ⌘-click a word in the editor)|Montrer le mot du curseur dans le PDF (⌘J, ou ⌘-clic sur un mot dans l'éditeur)|Mostrar la palabra del cursor en el PDF (⌘J, o ⌘-clic en una palabra)|Wort am Cursor im PDF zeigen (⌘J oder ⌘-Klick auf ein Wort)
ui.prevPage|Previous page|Page précédente|Página anterior|Vorherige Seite
ui.nextPage|Next page|Page suivante|Página siguiente|Nächste Seite
ui.page|Page|Page|Página|Seite
ui.downloadTip|Download PDF (⇧⌘E) — double-click the PDF to jump to source|Télécharger le PDF (⇧⌘E) — double-clic sur le PDF pour aller au source|Descargar PDF (⇧⌘E) — doble clic en el PDF para ir al código|PDF herunterladen (⇧⌘E) — Doppelklick im PDF springt zum Quelltext
ui.fullLog|Full log|Journal complet|Registro completo|Vollständiges Protokoll
ui.dismiss|Dismiss (Esc)|Fermer (Échap)|Cerrar (Esc)|Schließen (Esc)
ui.close|Close (Esc)|Fermer (Échap)|Cerrar (Esc)|Schließen (Esc)
ui.noSections|No sections yet|Aucune section|Aún no hay secciones|Noch keine Abschnitte
msg.ready|ready|prêt|listo|bereit
msg.compiled|compiled|compilé|compilado|kompiliert
msg.compiledW.one|compiled · {n} warning|compilé · {n} avertissement|compilado · {n} aviso|kompiliert · {n} Warnung
msg.compiledW.other|compiled · {n} warnings|compilé · {n} avertissements|compilado · {n} avisos|kompiliert · {n} Warnungen
msg.error|error|erreur|error|Fehler
msg.packageNeeded|package needed|paquet requis|paquete necesario|Paket nötig
msg.downloading|downloading packages…|téléchargement des paquets…|descargando paquetes…|Pakete werden geladen…
msg.preparing|preparing…|préparation…|preparando…|Vorbereitung…
msg.prepFormat|preparing the LaTeX format (first time only)|préparation du format LaTeX (première fois seulement)|preparando el formato LaTeX (solo la primera vez)|LaTeX-Format wird vorbereitet (nur beim ersten Mal)
msg.compiling|compiling…|compilation…|compilando…|wird kompiliert…
msg.pos|Ln {l}, Col {c}|Lig. {l}, Col. {c}|Lín. {l}, Col. {c}|Z. {l}, Sp. {c}
msg.words.one|{n} word|{n} mot|{n} palabra|{n} Wort
msg.words.other|{n} words|{n} mots|{n} palabras|{n} Wörter
msg.cannotRead|cannot read {name}|impossible de lire {name}|no se puede leer {name}|{name} kann nicht gelesen werden
msg.saveFailed|save failed: {e}|échec de l'enregistrement : {e}|error al guardar: {e}|Speichern fehlgeschlagen: {e}
msg.saved|saved {name}|{name} enregistré|{name} guardado|{name} gesichert
msg.autoSaveFailed|auto-save failed: {e}|échec de l'enregistrement auto : {e}|error en el autoguardado: {e}|Autospeichern fehlgeschlagen: {e}
msg.saveFirst|save the document first|enregistrez d'abord le document|guarda primero el documento|Dokument zuerst sichern
msg.compileFirst|compile first|compilez d'abord|compila primero|zuerst kompilieren
msg.notFoundInPdf|“{w}” not found in the PDF|« {w} » introuvable dans le PDF|«{w}» no se encuentra en el PDF|„{w}“ im PDF nicht gefunden
msg.cursorOnWord|put the cursor on a word first|placez d'abord le curseur sur un mot|coloca primero el cursor en una palabra|zuerst den Cursor auf ein Wort setzen
msg.chooseImage|choose a PNG, JPG or PDF image|choisissez une image PNG, JPG ou PDF|elige una imagen PNG, JPG o PDF|PNG-, JPG- oder PDF-Bild wählen
msg.imagesAdded|{n} images added|{n} images ajoutées|{n} imágenes añadidas|{n} Bilder hinzugefügt
msg.imageAdded|image added: {name}|image ajoutée : {name}|imagen añadida: {name}|Bild hinzugefügt: {name}
msg.imageUnsaved|image added (save the document so paths are relative)|image ajoutée (enregistrez le document pour des chemins relatifs)|imagen añadida (guarda el documento para usar rutas relativas)|Bild hinzugefügt (Dokument sichern für relative Pfade)
msg.pdfSaved|PDF saved: {name}|PDF enregistré : {name}|PDF guardado: {name}|PDF gesichert: {name}
msg.mainSet|main document: {name}|document principal : {name}|documento principal: {name}|Hauptdokument: {name}
msg.mainCleared|main document cleared|document principal retiré|documento principal quitado|Hauptdokument entfernt
msg.untitled|Untitled|Sans titre|Sin título|Unbenannt
msg.edited|Edited|Modifié|Editado|Bearbeitet
err.one|{n} error|{n} erreur|{n} error|{n} Fehler
err.other|{n} errors|{n} erreurs|{n} errores|{n} Fehler
err.warn.one|{n} warning|{n} avertissement|{n} aviso|{n} Warnung
err.warn.other|{n} warnings|{n} avertissements|{n} avisos|{n} Warnungen
err.failed|Compilation failed|La compilation a échoué|La compilación falló|Kompilierung fehlgeschlagen
err.downloadNeeded|Download needed|Téléchargement nécessaire|Descarga necesaria|Download nötig
err.clickToJump|— click to jump to the line|— cliquer pour aller à la ligne|— clic para ir a la línea|— klicken, um zur Zeile zu springen
err.pkgNeeded.one|Package needed|Paquet requis|Paquete necesario|Paket nötig
err.pkgNeeded.other|Packages needed|Paquets requis|Paquetes necesarios|Pakete nötig
err.pkgText|Not in the offline package cache. Plume can download it now (internet required).|Absent du cache hors ligne. Plume peut le télécharger maintenant (Internet requis).|No está en la caché sin conexión. Plume puede descargarlo ahora (requiere internet).|Nicht im Offline-Cache. Plume kann es jetzt herunterladen (Internet erforderlich).
err.downloadBtn|Download and compile|Télécharger et compiler|Descargar y compilar|Herunterladen und kompilieren
err.fileNotFound|File not found|Fichier introuvable|Archivo no encontrado|Datei nicht gefunden
err.fileNotFoundText|It is neither in the TeX bundle nor in your project folder. Add it next to your .tex file.|Il n'est ni dans la distribution TeX ni dans le dossier du projet. Ajoutez-le à côté de votre fichier .tex.|No está en la distribución TeX ni en la carpeta del proyecto. Añádelo junto a tu archivo .tex.|Weder in der TeX-Distribution noch im Projektordner. Fügen Sie es neben Ihrer .tex-Datei hinzu.
err.addFileBtn|Add file to project…|Ajouter un fichier au projet…|Añadir archivo al proyecto…|Datei zum Projekt hinzufügen…
spell.none|No suggestions|Aucune suggestion|Sin sugerencias|Keine Vorschläge
spell.add|Add to dictionary|Ajouter au dictionnaire|Añadir al diccionario|Zum Wörterbuch hinzufügen
spell.ignore|Ignore for this session|Ignorer pour cette session|Ignorar en esta sesión|In dieser Sitzung ignorieren
dlg.saveTitle|Do you want to save the changes made to “{name}”?|Voulez-vous enregistrer les modifications apportées à « {name} » ?|¿Quieres guardar los cambios realizados en «{name}»?|Möchten Sie die Änderungen an „{name}“ sichern?
dlg.saveDesc|Your changes will be lost if you don't save them.|Vos modifications seront perdues si vous ne les enregistrez pas.|Tus cambios se perderán si no los guardas.|Ihre Änderungen gehen verloren, wenn Sie sie nicht sichern.
dlg.save|Save|Enregistrer|Guardar|Sichern
dlg.dont|Don't Save|Ne pas enregistrer|No guardar|Nicht sichern
dlg.cancel|Cancel|Annuler|Cancelar|Abbrechen
prefs.title|Preferences|Préférences|Preferencias|Einstellungen
prefs.general|General|Général|General|Allgemein
prefs.language|Language|Langue|Idioma|Sprache
prefs.languageTip|Language of the menus, buttons and guide|Langue des menus, boutons et du guide|Idioma de los menús, botones y guía|Sprache der Menüs, Schaltflächen und Anleitung
prefs.theme|Theme|Thème|Tema|Design
prefs.editor|Editor|Éditeur|Editor|Editor
prefs.fontSize|Font size|Taille de police|Tamaño de fuente|Schriftgröße
prefs.tabSize|Tab width|Largeur de tabulation|Ancho de tabulación|Tab-Breite
prefs.wrap|Wrap long lines|Retour à la ligne automatique|Ajustar líneas largas|Lange Zeilen umbrechen
prefs.wrapTip|Off: lines scroll sideways|Désactivé : les lignes défilent horizontalement|Desactivado: las líneas se desplazan lateralmente|Aus: Zeilen scrollen seitlich
prefs.ligatures|Font ligatures|Ligatures de la police|Ligaduras de la fuente|Schriftligaturen
prefs.autoClose|Auto-close brackets, $ and \\begin…\\end|Fermeture automatique des accolades, $ et \\begin…\\end|Cierre automático de llaves, $ y \\begin…\\end|Klammern, $ und \\begin…\\end automatisch schließen
prefs.compile|Compiling & saving|Compilation et enregistrement|Compilación y guardado|Kompilieren & Sichern
prefs.autocompile|Autocompile while typing|Compilation automatique en tapant|Autocompilar al escribir|Beim Tippen automatisch kompilieren
prefs.autosave|Auto-save|Enregistrement automatique|Autoguardado|Automatisch sichern
prefs.keep|Keep downloaded packages after quit|Garder les paquets téléchargés après la fermeture|Conservar los paquetes descargados al salir|Heruntergeladene Pakete nach dem Beenden behalten
prefs.spelling|Spelling|Orthographe|Ortografía|Rechtschreibung
prefs.spellOn|Check spelling while typing|Vérifier l'orthographe en tapant|Revisar la ortografía al escribir|Rechtschreibung beim Tippen prüfen
prefs.spellLang|Spelling language|Langue du correcteur|Idioma del corrector|Sprache der Prüfung
prefs.userDict|Personal dictionary|Dictionnaire personnel|Diccionario personal|Persönliches Wörterbuch
prefs.userDictEmpty|No words yet. Right-click an underlined word → Add to dictionary.|Aucun mot. Clic droit sur un mot souligné → Ajouter au dictionnaire.|Aún no hay palabras. Clic derecho en una palabra subrayada → Añadir al diccionario.|Noch keine Wörter. Rechtsklick auf ein unterstrichenes Wort → Zum Wörterbuch hinzufügen.
prefs.window|Window|Fenêtre|Ventana|Fenster
prefs.outline|Show the outline sidebar|Afficher la barre latérale du plan|Mostrar la barra lateral del esquema|Gliederung anzeigen
prefs.visual|Visual editor|Éditeur visuel|Editor visual|Visueller Editor
prefs.reset|Reset all settings…|Réinitialiser tous les réglages…|Restablecer todos los ajustes…|Alle Einstellungen zurücksetzen…
prefs.resetAsk|Reset all settings to their defaults? Your documents are not affected.|Réinitialiser tous les réglages ? Vos documents ne sont pas modifiés.|¿Restablecer todos los ajustes? Tus documentos no se verán afectados.|Alle Einstellungen zurücksetzen? Ihre Dokumente bleiben unverändert.
menu.prefs|Preferences…|Préférences…|Preferencias…|Einstellungen…
menu.services|Services|Services|Servicios|Dienste
menu.hide|Hide Plume|Masquer Plume|Ocultar Plume|Plume ausblenden
menu.hide_others|Hide Others|Masquer les autres|Ocultar otros|Andere ausblenden
menu.show_all|Show All|Tout afficher|Mostrar todo|Alle einblenden
menu.quit|Quit Plume|Quitter Plume|Salir de Plume|Plume beenden
menu.about|About Plume|À propos de Plume|Acerca de Plume|Über Plume
menu.file|File|Fichier|Archivo|Ablage
menu.new|New|Nouveau|Nuevo|Neu
menu.new_tpl|New from Template|Nouveau à partir d'un modèle|Nuevo desde plantilla|Neu aus Vorlage
menu.tpl_article|Article|Article|Artículo|Artikel
menu.tpl_icml|ICML-style paper|Article de type ICML|Artículo estilo ICML|Paper im ICML-Stil
menu.tpl_neurips|NeurIPS-style paper|Article de type NeurIPS|Artículo estilo NeurIPS|Paper im NeurIPS-Stil
menu.tpl_ieee|IEEE conference paper|Article de conférence IEEE|Artículo de congreso IEEE|IEEE-Konferenzbeitrag
menu.tpl_beamer|Beamer presentation|Présentation Beamer|Presentación Beamer|Beamer-Präsentation
menu.tpl_cv|CV / Résumé|CV|CV / Currículum|Lebenslauf
menu.tpl_letter|Letter|Lettre|Carta|Brief
menu.open|Open…|Ouvrir…|Abrir…|Öffnen…
menu.close|Close Tab|Fermer l'onglet|Cerrar pestaña|Tab schließen
menu.save|Save|Enregistrer|Guardar|Sichern
menu.save_as|Save As…|Enregistrer sous…|Guardar como…|Sichern unter…
menu.save_all|Save All|Tout enregistrer|Guardar todo|Alle sichern
menu.autosave|Auto-Save|Enregistrement automatique|Autoguardado|Automatisch sichern
menu.export|Export PDF…|Exporter en PDF…|Exportar PDF…|PDF exportieren…
menu.both|Save .tex and PDF Together|Enregistrer le .tex et le PDF ensemble|Guardar .tex y PDF juntos|.tex und PDF zusammen sichern
menu.reveal|Show in Finder|Afficher dans le Finder|Mostrar en el Finder|Im Finder zeigen
menu.edit|Edit|Édition|Edición|Bearbeiten
menu.undo|Undo|Annuler|Deshacer|Widerrufen
menu.redo|Redo|Rétablir|Rehacer|Wiederholen
menu.cut|Cut|Couper|Cortar|Ausschneiden
menu.copy|Copy|Copier|Copiar|Kopieren
menu.paste|Paste|Coller|Pegar|Einsetzen
menu.select_all|Select All|Tout sélectionner|Seleccionar todo|Alles auswählen
menu.find|Find and Replace…|Rechercher et remplacer…|Buscar y reemplazar…|Suchen und Ersetzen…
menu.find_next|Find Next|Rechercher le suivant|Buscar siguiente|Weitersuchen
menu.find_prev|Find Previous|Rechercher le précédent|Buscar anterior|Rückwärts suchen
menu.goto|Go to Line…|Aller à la ligne…|Ir a la línea…|Gehe zu Zeile…
menu.comment|Toggle Comment|Commenter/décommenter|Alternar comentario|Kommentar umschalten
menu.move_up|Move Line Up|Monter la ligne|Mover línea arriba|Zeile nach oben
menu.move_down|Move Line Down|Descendre la ligne|Mover línea abajo|Zeile nach unten
menu.dup_line|Duplicate Line|Dupliquer la ligne|Duplicar línea|Zeile duplizieren
menu.spell|Check Spelling While Typing|Vérifier l'orthographe en tapant|Revisar ortografía al escribir|Rechtschreibung beim Tippen prüfen
menu.slang|Spelling Language|Langue du correcteur|Idioma del corrector|Sprache der Prüfung
menu.slang_auto|Automatic|Automatique|Automático|Automatisch
menu.addword|Add Word at Cursor to Dictionary|Ajouter le mot au curseur au dictionnaire|Añadir la palabra del cursor al diccionario|Wort am Cursor zum Wörterbuch hinzufügen
menu.build|Build|Compilation|Compilar|Erstellen
menu.compile|Compile|Compiler|Compilar|Kompilieren
menu.sync|Show Word in PDF|Voir le mot dans le PDF|Ver la palabra en el PDF|Wort im PDF zeigen
menu.main|Set as Main Document (Toggle)|Définir comme document principal (bascule)|Establecer como documento principal|Als Hauptdokument festlegen (umschalten)
menu.auto|Auto-Compile While Typing|Compilation automatique en tapant|Autocompilar al escribir|Beim Tippen automatisch kompilieren
menu.keep|Keep Downloaded Packages After Quit|Garder les paquets téléchargés après la fermeture|Conservar paquetes descargados al salir|Heruntergeladene Pakete nach Beenden behalten
menu.view|View|Présentation|Visualización|Darstellung
menu.theme_menu|Theme|Thème|Tema|Design
menu.theme_system|Match System|Suivre le système|Igual que el sistema|Wie System
menu.theme_light|Light|Clair|Claro|Hell
menu.theme_light-header|Light with Light Header|Clair avec en-tête clair|Claro con cabecera clara|Hell mit heller Kopfzeile
menu.theme_intellij|IntelliJ Light|IntelliJ Light|IntelliJ Light|IntelliJ Light
menu.theme_islands-light|Islands Light|Islands Light|Islands Light|Islands Light
menu.theme_fleet-light|Fleet Light|Fleet Light|Fleet Light|Fleet Light
menu.theme_dark|Dark|Sombre|Oscuro|Dunkel
menu.theme_darcula|Darcula|Darcula|Darcula|Darcula
menu.theme_islands-dark|Islands Dark|Islands Dark|Islands Dark|Islands Dark
menu.theme_fleet-dark|Fleet Dark|Fleet Dark|Fleet Dark|Fleet Dark
menu.theme_hc|High Contrast|Contraste élevé|Alto contraste|Hoher Kontrast
menu.theme|Toggle Light/Dark|Basculer clair/sombre|Alternar claro/oscuro|Hell/Dunkel umschalten
menu.visual|Toggle Visual Editor|Basculer l'éditeur visuel|Alternar editor visual|Visuellen Editor umschalten
menu.outline|Toggle Outline|Basculer le plan|Alternar esquema|Gliederung umschalten
menu.pdfpane|Toggle PDF Preview|Basculer l'aperçu PDF|Alternar vista previa PDF|PDF-Vorschau umschalten
menu.zoom_in|Zoom In|Agrandir|Acercar|Vergrößern
menu.zoom_out|Zoom Out|Réduire|Alejar|Verkleinern
menu.zoom_0|Actual Size|Taille réelle|Tamaño real|Originalgröße
menu.next_tab|Show Next Tab|Onglet suivant|Mostrar pestaña siguiente|Nächster Tab
menu.prev_tab|Show Previous Tab|Onglet précédent|Mostrar pestaña anterior|Vorheriger Tab
menu.fullscreen|Enter Full Screen|Passer en plein écran|Pantalla completa|Vollbildmodus
menu.language|Language|Langue|Idioma|Sprache
menu.window|Window|Fenêtre|Ventana|Fenster
menu.minimize|Minimize|Placer dans le Dock|Minimizar|Im Dock ablegen
menu.zoom|Zoom|Zoom|Zoom|Zoomen
menu.help|Help|Aide|Ayuda|Hilfe
menu.guide|Plume Guide|Guide de Plume|Guía de Plume|Plume-Anleitung
menu.keys|Keyboard Shortcuts|Raccourcis clavier|Atajos de teclado|Tastaturkürzel
"""
out = {l: {} for l in LANGS}
for line in T.strip().splitlines():
    k, *vals = line.split("|")
    assert len(vals) == len(LANGS), (k, len(vals))
    for l, v in zip(LANGS, vals): out[l][k] = v
os.makedirs("src/lang", exist_ok=True)
for l in LANGS:
    json.dump(out[l], open(f"src/lang/{l}.json", "w"), ensure_ascii=False, indent=0)
print({l: len(out[l]) for l in LANGS})
