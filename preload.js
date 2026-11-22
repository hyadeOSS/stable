const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hyadeOSElectron', Object.freeze({
    shutdown: () => ipcRenderer.invoke('hyadeos:shutdown'),
    reboot: () => ipcRenderer.invoke('hyadeos:reboot'),
    clearBrowserData: () => ipcRenderer.invoke('hyadeos:clear-browser-data'),
    browserExtensions: Object.freeze({
        list: () => ipcRenderer.invoke('hyadeos:extensions-list'),
        install: input => ipcRenderer.invoke('hyadeos:extensions-install', String(input)),
        loadUnpacked: () => ipcRenderer.invoke('hyadeos:extensions-load-unpacked'),
        setEnabled: (id, enabled) => ipcRenderer.invoke('hyadeos:extensions-set-enabled', String(id), !!enabled),
        remove: id => ipcRenderer.invoke('hyadeos:extensions-remove', String(id))
    }),
    onBrowserOpenTab: callback => ipcRenderer.on('browser:open-tab', (_event, url) => callback(String(url))),
    onBrowserShortcut: callback => ipcRenderer.on('browser:shortcut', (_event, name) => callback(String(name))),
    // Windows-style system keys (win, win+d, win+l, alt+f4...), see launcher.js.
    onSystemKey: callback => ipcRenderer.on('system:key', (_event, name) => callback(String(name))),
    // Win+Shift+S, Win+V and Win+. (see launcher.js).
    capture: rect => ipcRenderer.invoke('hyadeos:capture', rect),
    clipboardHistory: Object.freeze({
        list: () => ipcRenderer.invoke('hyadeos:clipboard-history'),
        clear: () => ipcRenderer.invoke('hyadeos:clipboard-clear'),
        paste: text => ipcRenderer.invoke('hyadeos:clipboard-paste', String(text))
    }),
    insertText: text => ipcRenderer.invoke('hyadeos:insert-text', String(text)),
    // An update changed the shell's own files: a full restart loads them (see launcher.js).
    onRestartNeeded: callback => ipcRenderer.on('system:restart-needed', () => callback()),
    relaunch: () => ipcRenderer.invoke('hyadeos:relaunch'),
    // Only answered for the local kernel-recovery.html screen (checked in launcher.js).
    kernelRecovery: Object.freeze({
        getState: () => ipcRenderer.invoke('hyadeos:recovery-state'),
        retry: () => ipcRenderer.invoke('hyadeos:recovery-retry'),
        rollback: () => ipcRenderer.invoke('hyadeos:recovery-rollback'),
        repairDependencies: () => ipcRenderer.invoke('hyadeos:recovery-repair'),
        openLogFolder: () => ipcRenderer.invoke('hyadeos:recovery-open-folder'),
        sendReport: () => ipcRenderer.invoke('hyadeos:recovery-send-report'),
        quit: () => ipcRenderer.invoke('hyadeos:recovery-quit')
    })
}));
