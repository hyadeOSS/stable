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
