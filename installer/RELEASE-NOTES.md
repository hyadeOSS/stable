## hyadeOS 2.1.1

### Fixes
- **Updater.** After one failed download the Updater could stay broken: the folder of the failed attempt could not be removed (a permission error on Windows) and every later "Update" failed the same way. Each download now has its own folder and cleaning up can no longer stop an update.
- **Apps check.** On a fresh install the Updater no longer shows "no such file or directory ... sota-installed.json" under Apps.

If you already have 2.1.0 and the Updater says "The update could not be downloaded", install this version with the installer, or close hyadeOS and delete the `hyadeos-staged-...` folders in `%LOCALAPPDATA%\Temp`.

**Full Changelog**: https://github.com/hyadeOSS/stable/compare/v2.1.0...v2.1.1

---

## hyadeOS 2.1.1 (italiano)

### Correzioni
- **Updater.** Dopo un download fallito l'Updater poteva restare rotto: la cartella del tentativo fallito non si riusciva a cancellare (errore di permessi su Windows) e ogni "Aggiorna" successivo falliva allo stesso modo. Ogni download ora ha una cartella propria e la pulizia non può più bloccare un aggiornamento.
- **Controllo delle app.** Su una nuova installazione l'Updater non mostra più "no such file or directory ... sota-installed.json" sotto Apps.

Se hai già la 2.1.0 e l'Updater dice "The update could not be downloaded", installa questa versione con l'installer, oppure chiudi hyadeOS e cancella le cartelle `hyadeos-staged-...` in `%LOCALAPPDATA%\Temp`.

---

## hyadeOS 2.1.0

### New
- **Tablet mode and tiling mode.** A full-screen tablet shell (home, dock, recents) and tiled windows (Ctrl+Alt+T; Ctrl+Alt+arrows move the focus).
- **Privacy mode.** A tile in the Control Panel: notifications hide their text, windows in the background are frosted and, in the app, screenshots and screen sharing see a blank window.
- **Alt+Tab.** hyadeOS has its own window switcher, in order of last use.
- **A new Browser** with a sidebar: spaces, favourites (Ctrl+1 to 9), Shift+B to fold the sidebar, and a photo on the new tab page.
- **Updates in two steps.** "Update now" downloads and checks the update in the background; "Restart now" installs it on a progress screen and starts the new version.
- **A much more capable Terminal:** pipes, redirections, variables, loops and scripts, plus network commands (`curl`, `ping`, `dig`...).
- **Sandbox** snapshots, logs, restart and export; **Store** sources, app versions, screenshots and sideload; **Activation** in Settings > About.

**Full Changelog**: https://github.com/hyadeOSS/stable/compare/v2.0.5...v2.1.0

---

## hyadeOS 2.1.0 (italiano)

### Novità
- **Modalità tablet e tiling.** Una shell a schermo intero per tablet (home, dock, recenti) e finestre affiancate (Ctrl+Alt+T; Ctrl+Alt+frecce spostano il focus).
- **Modalità privacy.** Una tessera nel Pannello di controllo: le notifiche nascondono il testo, le finestre in secondo piano sono sfocate e, nell'app, screenshot e condivisione schermo vedono una finestra nera.
- **Alt+Tab.** hyadeOS ha il suo selettore di finestre, in ordine di ultimo uso.
- **Un nuovo Browser** con barra laterale: spazi, preferiti (Ctrl+1…9), Shift+B per chiuderla e una foto nella pagina della nuova scheda.
- **Aggiornamenti in due passaggi.** "Aggiorna ora" scarica e controlla l'aggiornamento in background; "Riavvia ora" lo installa su una schermata di avanzamento e avvia la nuova versione.
- **Un Terminal molto più potente:** pipe, redirezioni, variabili, cicli e script, più comandi di rete (`curl`, `ping`, `dig`...).
- **Sandbox** con snapshot, log, riavvio ed export; **Store** con sorgenti, versioni delle app, screenshot e sideload; **Attivazione** in Impostazioni > Informazioni.

---

## hyadeOS 2.0.5

### Fixes
- **Restart in the middle of an update.** The "Restart to finish the update" offer no longer appears while an update is still being applied
  (restarting then could leave the system half updated).
- **Start-up screen.** No more "could not finish booting" error or broken image on a normal start. If the kernel cannot start, an npm repair hangs
  or the start is very slow, the recovery screen now appears instead of waiting forever.
- **Setup.** The two empty sections in the first-run highlights are gone.
- **Updater.** When the chosen channel is older than your version, the Updater says so and lets you switch back, with a confirmation.
- The project is spelled **hyadeOS** everywhere. The GitHub address stays `hyadeOSS`.

### Installer
- New installer `hyadeOS.Setup.2.0.5.exe`. Your data is brought over from the old `hyadeOSS` folder on first start, and a system left half updated is repaired.

**Full Changelog**: https://github.com/hyadeOSS/stable/compare/v2.0.4...v2.0.5

---

## hyadeOS 2.0.5 (italiano)

### Correzioni
- **Riavvio a metà aggiornamento.** L'invito "Restart to finish the update" non compare più mentre un aggiornamento è in corso.
- **Schermata di avvio.** Niente più errore "could not finish booting" o immagine rotta a un avvio normale. Se il server non parte, `npm` si blocca o l'avvio è molto lento, compare la schermata di recupero invece di aspettare per sempre.
- **Configurazione iniziale.** Le due sezioni vuote non ci sono più.
- **Updater.** Se il canale scelto è più vecchio della tua versione, lo dice e permette di tornare indietro con una conferma.
- Il progetto si scrive **hyadeOS** ovunque; l'indirizzo GitHub resta `hyadeOSS`.

### Installer
- Nuovo installer `hyadeOS.Setup.2.0.5.exe`. I dati vengono portati dalla vecchia cartella `hyadeOSS` al primo avvio e un sistema rimasto a metà aggiornamento viene riparato.
