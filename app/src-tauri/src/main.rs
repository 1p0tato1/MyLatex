use std::{fs, io::{BufRead, BufReader, Read, Write}, path::{Path, PathBuf}, process::{Command, Stdio},
    sync::{atomic::{AtomicBool, AtomicU32, Ordering}, Arc, Mutex}, time::{Duration, Instant}};
use tauri::{ipc::Response, menu::{CheckMenuItem, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, RunEvent, State, Wry};
use std::collections::HashMap;
use rfd::{AsyncMessageDialog, MessageButtons, MessageDialogResult, MessageLevel};

struct Checks { auto: CheckMenuItem<Wry>, spell: CheckMenuItem<Wry>, autosave: CheckMenuItem<Wry>, keep: CheckMenuItem<Wry>,
    themes: Vec<(String, CheckMenuItem<Wry>)>, langs: Vec<(String, CheckMenuItem<Wry>)>, slangs: Vec<(String, CheckMenuItem<Wry>)> }
type Cs<'a> = State<'a, Mutex<Checks>>;
static PENDING: Mutex<Vec<String>> = Mutex::new(Vec::new()); // fichiers ouverts depuis le Finder avant que l'UI soit prête

fn dir_size(p: &Path) -> u64 {
    fs::read_dir(p).map(|d| d.flatten().map(|e| match e.metadata() {
        Ok(m) if m.is_dir() => dir_size(&e.path()),
        Ok(m) => m.len(),
        _ => 0,
    }).sum()).unwrap_or(0)
}

// Cache des packages Tectonic: supprimé à la fermeture sauf si "garder" est coché.
static KEEP: AtomicBool = AtomicBool::new(true);
static CHILD: AtomicU32 = AtomicU32::new(0); // pid du Tectonic en cours
static STOP: AtomicBool = AtomicBool::new(false); // bouton Stop
// Délais de sécurité (document qui boucle); plus large quand des paquets sont à télécharger.
const LIMIT_OFFLINE: Duration = Duration::from_secs(180);
const LIMIT_ONLINE: Duration = Duration::from_secs(900);

#[tauri::command]
fn stop_compile() { STOP.store(true, Ordering::Relaxed) }

// Tue `pid` (notre Tectonic) si Stop est demandé ou si `limit` est dépassée, tant que `done` est faux. Renvoie la raison.
fn watchdog(pid: u32, done: Arc<AtomicBool>, limit: Duration) -> std::thread::JoinHandle<Option<&'static str>> {
    std::thread::spawn(move || {
        let start = Instant::now();
        while !done.load(Ordering::Relaxed) {
            let why = if STOP.load(Ordering::Relaxed) { Some("stop") } else if start.elapsed() > limit { Some("timeout") } else { None };
            if why.is_some() { let _ = Command::new("kill").args(["-9", &pid.to_string()]).status(); return why; }
            std::thread::sleep(Duration::from_millis(100));
        }
        None
    })
}

fn cache() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())).join("Library/Caches/mylatex")
}
fn scratch() -> PathBuf { std::env::temp_dir().join("mylatex") }

fn tectonic() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let d = exe.parent().map(|p| p.to_path_buf()).unwrap_or_default();
    [d.join("tectonic"), d.join("../Resources/tectonic"), PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../bin/tectonic")]
        .into_iter().find(|p| p.exists()).unwrap_or_else(|| "tectonic".into())
}

// Cache pré-rempli (format + paquets courants) livré avec l'app: évite ~150 s de téléchargements au 1er compile.
static SEED: std::sync::Mutex<()> = std::sync::Mutex::new(());
fn seed() {
    let _g = SEED.lock();
    let exe = std::env::current_exe().unwrap_or_default();
    let d = exe.parent().map(|p| p.to_path_buf()).unwrap_or_default();
    let Some(src) = [d.join("../Resources/seed-cache"), PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../bin/seed-cache")]
        .into_iter().find(|p| p.exists()) else { return };
    let ver = |p: &Path| fs::read_to_string(p.join(".seed-v")).unwrap_or_default();
    if cache().join("formats").exists() && ver(&cache()) == ver(&src) { return; }
    // Fusion sans écraser (-n): garde les paquets déjà téléchargés, ajoute ceux du cache de départ. -c = clone APFS (instantané).
    let _ = fs::create_dir_all(cache());
    let from = format!("{}/.", src.display());
    if !Command::new("cp").arg("-cRn").arg(&from).arg(cache()).status().map(|s| s.success()).unwrap_or(false) {
        let _ = Command::new("cp").arg("-Rn").arg(&from).arg(cache()).status();
    }
    let _ = fs::write(cache().join(".seed-v"), ver(&src));
}

#[tauri::command]
fn set_keep(keep: bool) { KEEP.store(keep, Ordering::Relaxed) }

#[tauri::command]
fn set_check(checks: Cs, id: String, on: bool) {
    let c = checks.lock().unwrap();
    let _ = match id.as_str() { "auto" => c.auto.set_checked(on), "autosave" => c.autosave.set_checked(on), "spell" => c.spell.set_checked(on), _ => c.keep.set_checked(on) };
}

#[tauri::command]
fn set_theme_check(checks: Cs, name: String) {
    for (n, c) in &checks.lock().unwrap().themes { let _ = c.set_checked(*n == name); }
}

#[tauri::command]
fn set_lang_check(checks: Cs, code: String) {
    for (n, c) in &checks.lock().unwrap().langs { let _ = c.set_checked(*n == code); }
}

#[tauri::command]
fn set_slang_check(checks: Cs, mode: String) {
    for (n, c) in &checks.lock().unwrap().slangs { let _ = c.set_checked(*n == mode); }
}

// Reconstruit la barre de menus avec des libellés traduits (id -> texte), en conservant l'état des interrupteurs.
#[tauri::command]
fn set_menu_labels(app: AppHandle, checks: Cs, labels: HashMap<String, String>) {
    let Ok(new) = build_menu(&app, &labels) else { return };
    let mut g = checks.lock().unwrap();
    let cp = |a: &CheckMenuItem<Wry>, b: &CheckMenuItem<Wry>| { if let Ok(v) = a.is_checked() { let _ = b.set_checked(v); } };
    cp(&g.auto, &new.auto); cp(&g.spell, &new.spell); cp(&g.autosave, &new.autosave); cp(&g.keep, &new.keep);
    for (v_old, v_new) in [(&g.themes, &new.themes), (&g.langs, &new.langs), (&g.slangs, &new.slangs)] {
        for ((_, a), (_, b)) in v_old.iter().zip(v_new.iter()) { cp(a, b); }
    }
    *g = new;
}

#[tauri::command]
fn take_pending() -> Vec<String> { std::mem::take(&mut *PENDING.lock().unwrap()) }

#[tauri::command]
fn quit(app: AppHandle) { app.exit(0) }

// Version réelle de l'app: celle du tag, passée par tools/release.sh (sinon Cargo.toml)
#[tauri::command]
fn app_version() -> &'static str { option_env!("MYLATEX_VERSION").unwrap_or(env!("CARGO_PKG_VERSION")) }

#[tauri::command]
fn open_releases() { let _ = Command::new("open").arg("https://github.com/1p0tato1/MyLatex/releases/latest").status(); }

#[tauri::command]
fn reveal(path: String) { let _ = Command::new("open").args(["-R", &path]).status(); }

#[tauri::command]
fn read_file(path: String) -> Option<String> { fs::read_to_string(path).ok() }

#[tauri::command]
fn write_file(path: String, text: String) -> Result<(), String> { fs::write(path, text).map_err(|e| e.to_string()) }

// Sélection multiple de .tex
#[tauri::command]
async fn open_dialog() -> Vec<String> {
    rfd::AsyncFileDialog::new().add_filter("LaTeX", &["tex"]).pick_files().await
        .map(|v| v.iter().map(|f| f.path().to_string_lossy().into()).collect()).unwrap_or_default()
}

#[tauri::command]
async fn folder_dialog() -> Option<String> {
    Some(rfd::AsyncFileDialog::new().pick_folder().await?.path().to_string_lossy().into())
}

// Contenu d'un dossier (un seul niveau): (nom, est un dossier). Fichiers cachés ignorés, dossiers d'abord.
#[tauri::command]
fn list_dir(path: String) -> Vec<(String, bool)> {
    let mut v: Vec<(String, bool)> = fs::read_dir(path).map(|d| d.flatten()
        .map(|e| (e.file_name().to_string_lossy().into_owned(), e.path().is_dir()))
        .filter(|(n, _)| !n.starts_with('.')).collect()).unwrap_or_default();
    v.sort_by_key(|(n, is_dir)| (!is_dir, n.to_lowercase()));
    v
}

#[tauri::command]
async fn save_dialog(name: String, dir: Option<String>) -> Option<String> {
    let mut d = rfd::AsyncFileDialog::new().set_file_name(name);
    if let Some(dir) = dir { d = d.set_directory(dir); }
    Some(d.save_file().await?.path().to_string_lossy().into())
}

// 0 = Save, 1 = Don't Save, 2 = Cancel
#[tauri::command]
async fn ask_save(title: String, desc: String, save: String, dont: String, cancel: String) -> u8 {
    let r = AsyncMessageDialog::new().set_level(MessageLevel::Warning).set_title(title).set_description(desc)
        .set_buttons(MessageButtons::YesNoCancelCustom(save.clone(), dont.clone(), cancel)).show().await;
    match r { MessageDialogResult::Custom(s) if s == save => 0, MessageDialogResult::Custom(s) if s == dont => 1, _ => 2 }
}

// Copie le PDF compilé de l'onglet `id` vers `dest`, ou demande où.
#[tauri::command]
async fn export_pdf(id: String, name: String, dir: Option<String>, dest: Option<String>) -> Option<String> {
    let src = scratch().join("out").join(&id).join("texput.pdf");
    let dest = match dest {
        Some(d) => PathBuf::from(d),
        None => {
            let mut dlg = rfd::AsyncFileDialog::new().add_filter("PDF", &["pdf"]).set_file_name(format!("{name}.pdf"));
            if let Some(dir) = dir { dlg = dlg.set_directory(dir); }
            dlg.save_file().await?.path().to_path_buf()
        }
    };
    fs::copy(src, &dest).ok()?;
    Some(dest.to_string_lossy().into())
}

// Lance Tectonic (source passée par stdin: le fichier de l'utilisateur n'est jamais modifié par la compilation).
fn run_once(app: &AppHandle, cached: bool, cwd: &Path, out: &Path, text: &str) -> Result<(bool, String, String), String> {
    let mut c = Command::new(tectonic());
    c.current_dir(cwd).env("TECTONIC_CACHE_DIR", cache());
    if cached { c.arg("-C"); }
    let mut child = c.arg("--synctex").arg("--outdir").arg(out).arg("-")
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .spawn().map_err(|e| format!("tectonic not found: {e}"))?;
    CHILD.store(child.id(), Ordering::Relaxed);
    let mut si = child.stdin.take().unwrap();
    let txt = text.to_owned();
    std::thread::spawn(move || { let _ = si.write_all(txt.as_bytes()); });

    // taille du cache en direct (Mo téléchargés)
    // (inutile en mode hors-ligne -C: rien n'est téléchargé, on évite de parcourir le cache en boucle)
    let done = Arc::new(AtomicBool::new(false));
    let limit = if cached { LIMIT_OFFLINE } else { LIMIT_ONLINE };
    let guard = watchdog(child.id(), done.clone(), limit);
    if !cached {
        let (d, a2, base) = (done.clone(), app.clone(), dir_size(&cache()));
        std::thread::spawn(move || while !d.load(Ordering::Relaxed) {
            let _ = a2.emit("tex-mb", dir_size(&cache()).saturating_sub(base) as f64 / 1e6);
            std::thread::sleep(Duration::from_millis(700));
        });
    }
    let mut so = child.stdout.take().unwrap();
    let t = std::thread::spawn(move || { let mut s = String::new(); let _ = so.read_to_string(&mut s); s });
    let mut log = String::new();
    for l in BufReader::new(child.stderr.take().unwrap()).lines().flatten() {
        let _ = app.emit("tex-log", &l);
        log += &l; log.push('\n');
    }
    let ok = child.wait().map(|s| s.success()).unwrap_or(false);
    done.store(true, Ordering::Relaxed);
    CHILD.store(0, Ordering::Relaxed);
    match guard.join().unwrap_or(None) {
        Some("stop") => return Err("STOPPED".into()),
        Some(_) => return Err(format!("error: compilation stopped after {} seconds (infinite loop in the document?)\n{log}", limit.as_secs())),
        None => {}
    }
    Ok((ok,t.join().unwrap_or_default(), log))
}

// Noms de fichiers signalés "not found" dans le log TeX: `File `x.sty' not found`.
fn missing_files(log: &str) -> Vec<String> {
    let mut v: Vec<String> = vec![];
    // police absente: "Font T1/cmr/m/n/10=ecrm1000 at 10.0pt not loadable: Metric (TFM) file ... not found"
    for l in log.lines().filter(|l| l.contains("not loadable")) {
        if let Some(i) = l.find('=') {
            let n: String = l[i + 1..].chars().take_while(|c| !c.is_whitespace()).collect();
            if !n.is_empty() && !v.contains(&n) { v.push(n); }
        }
    }
    for l in log.lines().filter(|l| l.contains("not found")) {
        if let (Some(a), Some(b)) = (l.find('`'), l.find('\'')) {
            if b > a + 1 { let n = l[a + 1..b].to_string(); if !n.contains('#') && !v.contains(&n) { v.push(n); } } // "#1.#2" = macro TeX, pas un fichier
        }
    }
    v
}

// Copie `src` dans `dir/figures/` (sans écraser un fichier différent) et renvoie le chemin relatif `figures/<nom>`.
#[tauri::command]
fn copy_into(src: String, dir: String, sub: Option<String>) -> Option<String> {
    let sub = sub.unwrap_or_else(|| "figures".into());
    let target = Path::new(&dir).join(&sub);
    fs::create_dir_all(&target).ok()?;
    let name = Path::new(&src).file_name()?.to_string_lossy().to_string();
    let name = if sub == "." { name } else { name.replace(' ', "-") }; // les espaces posent problème à LaTeX
    let (stem, ext) = match name.rsplit_once('.') { Some((s, e)) => (s.to_string(), format!(".{e}")), None => (name.clone(), String::new()) };
    let size = fs::metadata(&src).ok()?.len();
    let mut n = 0;
    loop {
        let cand = if n == 0 { name.clone() } else { format!("{stem}-{n}{ext}") };
        let p = target.join(&cand);
        match fs::metadata(&p) {
            Ok(m) if m.len() == size => return Some(format!("{sub}/{cand}")), // déjà là (même taille)
            Ok(_) => n += 1,
            Err(_) => { fs::copy(&src, &p).ok()?; return Some(format!("{sub}/{cand}")); }
        }
    }
}

// Choisir un fichier quelconque (ex.: un .sty manquant) à ajouter au projet
#[tauri::command]
async fn pick_file() -> Option<String> {
    Some(rfd::AsyncFileDialog::new().pick_file().await?.path().to_string_lossy().into())
}

// Compile `text` (dans le dossier de `path` pour les \input relatifs); renvoie les octets du PDF ou le log d'erreur.
#[tauri::command]
async fn compile(app: AppHandle, id: String, path: Option<String>, text: String, online: Option<bool>) -> Result<Response, String> {
    STOP.store(false, Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = path.as_deref().and_then(|p| Path::new(p).parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| { fs::create_dir_all(scratch()).ok(); scratch() });
        seed();
        let out = scratch().join("out").join(&id);
        fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        // 1er essai hors-ligne (-C): évite les accès réseau si tout est en cache; repli en ligne sinon.
        let warm = cache().join("formats").read_dir().map(|mut d| d.next().is_some()).unwrap_or(false);
        let cached = warm && !online.unwrap_or(false);
        let r = run_once(&app, cached, &cwd, &out, &text)?;
        if !r.0 {
            // Hors-ligne: un fichier introuvable peut être un paquet à télécharger -> on propose au lieu de le faire en silence.
            let miss = if cached { missing_files(&(r.1.clone() + &r.2)) } else { vec![] };
            if !miss.is_empty() { return Err(format!("MISSING\n{}", miss.join("\n"))); }
            return Err(r.1 + &r.2);
        }
        fs::read(out.join("texput.pdf")).map(Response::new).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

// SyncTeX (gzip) de la dernière compilation de l'onglet `id`; décompressé côté JS.
#[tauri::command]
fn synctex(id: String) -> Response {
    Response::new(fs::read(scratch().join("out").join(id).join("texput.synctex.gz")).unwrap_or_default())
}

fn build_menu(app: &AppHandle, labels: &HashMap<String, String>) -> tauri::Result<Checks> {
    let lb = |id: &str, def: &str| labels.get(id).cloned().unwrap_or_else(|| def.to_string());
    let it = |id: &str, def: &str, acc: Option<&str>| {
        let b = MenuItemBuilder::with_id(id, lb(id, def));
        match acc { Some(a) => b.accelerator(a).build(app), None => b.build(app) }
    };
    let chk = |id: &str, def: &str, on: bool| CheckMenuItemBuilder::with_id(id, lb(id, def)).checked(on).build(app);
    let auto = chk("auto", "Auto-Compile While Typing", true)?;
    let spell = chk("spell", "Check Spelling While Typing", true)?;
    let autosave = chk("autosave", "Auto-Save", false)?;
    let keep = chk("keep", "Keep Downloaded Packages After Quit", true)?;

    let mylatex = SubmenuBuilder::new(app, "MyLatex").about_with_text(lb("about", "About MyLatex"), None).separator()
        .item(&it("prefs", "Preferences…", Some("CmdOrCtrl+,"))?).separator()
        .services_with_text(lb("services", "Services")).separator()
        .hide_with_text(lb("hide", "Hide MyLatex")).hide_others_with_text(lb("hide_others", "Hide Others")).show_all_with_text(lb("show_all", "Show All")).separator()
        .item(&it("quit", "Quit MyLatex", Some("CmdOrCtrl+Q"))?).build()?;

    let mut tpl = SubmenuBuilder::new(app, lb("new_tpl", "New from Template"));
    for (id, def) in [("tpl_article", "Article"), ("tpl_icml", "ICML-style paper"), ("tpl_neurips", "NeurIPS-style paper"), ("tpl_ieee", "IEEE conference paper"),
        ("tpl_beamer", "Beamer presentation"), ("tpl_cv", "CV / Résumé"), ("tpl_letter", "Letter")] { tpl = tpl.item(&it(id, def, None)?); }
    let tpl = tpl.build()?;
    let file = SubmenuBuilder::new(app, lb("file", "File"))
        .item(&it("new", "New", Some("CmdOrCtrl+N"))?).item(&tpl).item(&it("open", "Open…", Some("CmdOrCtrl+O"))?)
        .item(&it("open_folder", "Open Folder…", Some("CmdOrCtrl+Shift+O"))?).separator()
        .item(&it("close", "Close Tab", Some("CmdOrCtrl+W"))?).separator()
        .item(&it("save", "Save", Some("CmdOrCtrl+S"))?).item(&it("save_as", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        .item(&it("save_all", "Save All", Some("CmdOrCtrl+Alt+S"))?).item(&autosave).separator()
        .item(&it("export", "Export PDF…", Some("CmdOrCtrl+Shift+E"))?)
        .item(&it("both", "Save .tex and PDF Together", None)?).separator()
        .item(&it("reveal", "Show in Finder", None)?).build()?;

    let mut slangs: Vec<(String, CheckMenuItem<Wry>)> = vec![];
    let mut sb = SubmenuBuilder::new(app, lb("slang", "Spelling Language"));
    for (id, def) in [("auto", "Automatic"), ("en", "English"), ("fr", "Français")] {
        let c = CheckMenuItemBuilder::with_id(format!("slang_{id}"), if id == "auto" { lb("slang_auto", def) } else { def.to_string() }).checked(id == "auto").build(app)?;
        sb = sb.item(&c); slangs.push((id.to_string(), c));
    }
    let slang_menu = sb.build()?;
    let edit = SubmenuBuilder::new(app, lb("edit", "Edit"))
        .undo_with_text(lb("undo", "Undo")).redo_with_text(lb("redo", "Redo")).separator()
        .cut_with_text(lb("cut", "Cut")).copy_with_text(lb("copy", "Copy")).paste_with_text(lb("paste", "Paste")).select_all_with_text(lb("select_all", "Select All")).separator()
        .item(&it("find", "Find and Replace…", Some("CmdOrCtrl+F"))?).item(&it("find_next", "Find Next", Some("CmdOrCtrl+G"))?)
        .item(&it("find_prev", "Find Previous", Some("CmdOrCtrl+Shift+G"))?).item(&it("goto", "Go to Line…", Some("CmdOrCtrl+L"))?).separator()
        .item(&it("comment", "Toggle Comment", Some("CmdOrCtrl+/"))?)
        .item(&it("move_up", "Move Line Up", Some("Alt+Up"))?).item(&it("move_down", "Move Line Down", Some("Alt+Down"))?)
        .item(&it("dup_line", "Duplicate Line", Some("Alt+Shift+Down"))?).separator()
        .item(&spell).item(&slang_menu).item(&it("addword", "Add Word at Cursor to Dictionary", None)?).build()?;

    let build = SubmenuBuilder::new(app, lb("build", "Build"))
        .item(&it("compile", "Compile", Some("CmdOrCtrl+Return"))?)
        .item(&it("stop", "Stop Compilation", Some("CmdOrCtrl+."))?)
        .item(&it("sync", "Show Word in PDF", Some("CmdOrCtrl+J"))?).separator()
        .item(&it("main", "Set as Main Document (Toggle)", Some("CmdOrCtrl+Shift+M"))?).separator()
        .item(&auto).item(&keep).build()?;

    let mut themes: Vec<(String, CheckMenuItem<Wry>)> = vec![];
    let mut tb = SubmenuBuilder::new(app, lb("theme_menu", "Theme"));
    for (id, def) in [("system", "Match System"), ("-", ""), ("light", "Light"), ("light-header", "Light with Light Header"),
        ("intellij", "IntelliJ Light"), ("islands-light", "Islands Light"), ("fleet-light", "Fleet Light"), ("-", ""),
        ("dark", "Dark"), ("darcula", "Darcula"), ("islands-dark", "Islands Dark"), ("fleet-dark", "Fleet Dark"), ("-", ""),
        ("hc", "High Contrast")] {
        if id == "-" { tb = tb.separator(); continue; }
        let c = CheckMenuItemBuilder::with_id(format!("theme_{id}"), lb(&format!("theme_{id}"), def)).checked(false).build(app)?;
        tb = tb.item(&c); themes.push((id.to_string(), c));
    }
    let theme_menu = tb.build()?;
    let mut langs: Vec<(String, CheckMenuItem<Wry>)> = vec![];
    let mut lbld = SubmenuBuilder::new(app, lb("language", "Language"));
    for (id, name) in [("en", "English"), ("fr", "Français"), ("es", "Español"), ("de", "Deutsch")] {
        let c = CheckMenuItemBuilder::with_id(format!("lang_{id}"), name).checked(id == "en").build(app)?;
        lbld = lbld.item(&c); langs.push((id.to_string(), c));
    }
    let lang_menu = lbld.build()?;
    let view = SubmenuBuilder::new(app, lb("view", "View"))
        .item(&theme_menu).item(&it("theme", "Toggle Light/Dark", Some("CmdOrCtrl+Shift+D"))?)
        .item(&it("visual", "Toggle Visual Editor", Some("CmdOrCtrl+Alt+V"))?)
        .item(&it("outline", "Toggle Outline", Some("CmdOrCtrl+Alt+O"))?)
        .item(&it("pdfpane", "Toggle PDF Preview", Some("CmdOrCtrl+Alt+P"))?).item(&lang_menu).separator()
        .item(&it("zoom_in", "Zoom In", Some("CmdOrCtrl+="))?).item(&it("zoom_out", "Zoom Out", Some("CmdOrCtrl+-"))?)
        .item(&it("zoom_0", "Actual Size", Some("CmdOrCtrl+0"))?).separator()
        .item(&it("next_tab", "Show Next Tab", Some("CmdOrCtrl+Shift+]"))?).item(&it("prev_tab", "Show Previous Tab", Some("CmdOrCtrl+Shift+["))?)
        .fullscreen_with_text(lb("fullscreen", "Enter Full Screen")).build()?;
    let window = SubmenuBuilder::new(app, lb("window", "Window")).minimize_with_text(lb("minimize", "Minimize")).maximize_with_text(lb("zoom", "Zoom")).build()?;
    let help = SubmenuBuilder::new(app, lb("help", "Help"))
        .item(&it("guide", "MyLatex Guide", Some("CmdOrCtrl+Shift+/"))?).item(&it("latexref", "LaTeX Essentials", None)?).item(&it("keys", "Keyboard Shortcuts", None)?).build()?;
    app.set_menu(MenuBuilder::new(app).items(&[&mylatex, &file, &edit, &build, &view, &window, &help]).build()?)?;
    let _ = window.set_as_windows_menu_for_nsapp();
    let _ = help.set_as_help_menu_for_nsapp();
    Ok(Checks { auto, spell, autosave, keep, themes, langs, slangs })
}

fn main() {
    std::thread::spawn(seed);
    tauri::Builder::default()
        .setup(|app| { let c = build_menu(app.handle(), &HashMap::new())?; app.manage(Mutex::new(c)); Ok(()) })
        .on_menu_event(|app, e| { let _ = app.emit("menu", e.id().as_ref()); })
        .invoke_handler(tauri::generate_handler![set_menu_labels, set_lang_check, set_slang_check, copy_into, pick_file, synctex, set_theme_check, set_keep, set_check, take_pending, quit, stop_compile, app_version, open_releases, reveal, read_file, write_file,
            open_dialog, folder_dialog, list_dir, save_dialog, ask_save, export_pdf, compile])
        .build(tauri::generate_context!())
        .expect("tauri")
        .run(|app, e| match e {
            RunEvent::Opened { urls } => {
                let v: Vec<String> = urls.iter().filter_map(|u| u.to_file_path().ok()).map(|p| p.to_string_lossy().into()).collect();
                PENDING.lock().unwrap().extend(v.clone());
                let _ = app.emit("open-paths", v);
            }
            RunEvent::Exit => {
                let pid = CHILD.load(Ordering::Relaxed);
                if pid != 0 { let _ = Command::new("kill").args(["-9", &pid.to_string()]).status(); std::thread::sleep(Duration::from_millis(300)); }
                let _ = fs::remove_dir_all(scratch());
                if !KEEP.load(Ordering::Relaxed) { let _ = fs::remove_dir_all(cache()); }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    #[test]
    fn watchdog_kills_a_process_that_exceeds_the_limit() {
        use std::{sync::{atomic::AtomicBool, Arc}, time::Duration};
        let mut child = std::process::Command::new("sleep").arg("30").spawn().unwrap();
        let guard = super::watchdog(child.id(), Arc::new(AtomicBool::new(false)), Duration::from_millis(200));
        assert!(!child.wait().unwrap().success());
        assert_eq!(guard.join().unwrap(), Some("timeout"));
    }

    #[test]
    fn list_dir_hides_dotfiles_and_puts_folders_first() {
        let d = std::env::temp_dir().join(format!("mylatex-list-{}", std::process::id()));
        std::fs::create_dir_all(d.join("zfig")).unwrap();
        for f in ["b.tex", "A.bib", ".hidden"] { std::fs::write(d.join(f), "").unwrap(); }
        let got = super::list_dir(d.to_string_lossy().into());
        std::fs::remove_dir_all(&d).unwrap();
        assert_eq!(got, [("zfig".into(), true), ("A.bib".into(), false), ("b.tex".into(), false)]);
    }
}
