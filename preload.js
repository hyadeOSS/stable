const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hyadeOSSElectron', Object.freeze({
    shutdown: () => ipcRenderer.invoke('hyadeoss:shutdown'),
    reboot: () => ipcRenderer.invoke('hyadeoss:reboot'),
    clearBrowserData: () => ipcRenderer.invoke('hyadeoss:clear-browser-data'),
    browserExtensions: Object.freeze({
        list: () => ipcRenderer.invoke('hyadeoss:extensions-list'),
        install: input => ipcRenderer.invoke('hyadeoss:extensions-install', String(input)),
        loadUnpacked: () => ipcRenderer.invoke('hyadeoss:extensions-load-unpacked'),
        setEnabled: (id, enabled) => ipcRenderer.invoke('hyadeoss:extensions-set-enabled', String(id), !!enabled),
        remove: id => ipcRenderer.invoke('hyadeoss:extensions-remove', String(id))
    }),
    onBrowserOpenTab: callback => ipcRenderer.on('browser:open-tab', (_event, url) => callback(String(url))),
    onBrowserShortcut: callback => ipcRenderer.on('browser:shortcut', (_event, name) => callback(String(name))),
    // Windows-style system keys (win, win+d, win+l, alt+f4...), see launcher.js.
    onSystemKey: callback => ipcRenderer.on('system:key', (_event, name) => callback(String(name))),
    // Win+Shift+S, Win+V and Win+. (see launcher.js).
    capture: rect => ipcRenderer.invoke('hyadeoss:capture', rect),
    clipboardHistory: Object.freeze({
        list: () => ipcRenderer.invoke('hyadeoss:clipboard-history'),
        clear: () => ipcRenderer.invoke('hyadeoss:clipboard-clear'),
        paste: text => ipcRenderer.invoke('hyadeoss:clipboard-paste', String(text))
    }),
    insertText: text => ipcRenderer.invoke('hyadeoss:insert-text', String(text)),
    // An update changed the shell's own files: a full restart loads them (see launcher.js).
    onRestartNeeded: callback => ipcRenderer.on('system:restart-needed', () => callback()),
    relaunch: () => ipcRenderer.invoke('hyadeoss:relaunch'),
    // Only answered for the local kernel-recovery.html screen (checked in launcher.js).
    kernelRecovery: Object.freeze({
        getState: () => ipcRenderer.invoke('hyadeoss:recovery-state'),
        retry: () => ipcRenderer.invoke('hyadeoss:recovery-retry'),
        rollback: () => ipcRenderer.invoke('hyadeoss:recovery-rollback'),
        repairDependencies: () => ipcRenderer.invoke('hyadeoss:recovery-repair'),
        openLogFolder: () => ipcRenderer.invoke('hyadeoss:recovery-open-folder'),
        sendReport: () => ipcRenderer.invoke('hyadeoss:recovery-send-report'),
        quit: () => ipcRenderer.invoke('hyadeoss:recovery-quit')
    })
}));
