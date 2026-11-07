/**
 * Preload bridge: the only thing the page can reach from Electron is the
 * `window.desktop` API defined in desktop/shared.ts (context isolation + sandbox).
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IPC, type DesktopApi, type DesktopInfo, type DesktopPathKind, type UpdateState } from "./shared";

const api: DesktopApi = {
  info: () => ipcRenderer.invoke(IPC.info) as Promise<DesktopInfo>,
  update: {
    state: () => ipcRenderer.invoke(IPC.updateState) as Promise<UpdateState>,
    check: () => ipcRenderer.invoke(IPC.updateCheck) as Promise<UpdateState>,
    download: () => ipcRenderer.invoke(IPC.updateDownload) as Promise<UpdateState>,
    install: () => ipcRenderer.invoke(IPC.updateInstall) as Promise<void>,
    dismiss: () => ipcRenderer.invoke(IPC.updateDismiss) as Promise<void>,
    onState: (listener) => {
      const handler = (_e: IpcRendererEvent, state: UpdateState) => listener(state);
      ipcRenderer.on(IPC.updateEvent, handler);
      return () => {
        ipcRenderer.removeListener(IPC.updateEvent, handler);
      };
    },
    setToken: (token: string) => ipcRenderer.invoke(IPC.updateSetToken, token) as Promise<DesktopInfo>,
  },
  openPath: (kind: DesktopPathKind) => ipcRenderer.invoke(IPC.openPath, kind) as Promise<void>,
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url) as Promise<void>,
  openInBrowser: () => ipcRenderer.invoke(IPC.openInBrowser) as Promise<void>,
  chooseExchangeDir: () => ipcRenderer.invoke(IPC.chooseExchangeDir) as Promise<DesktopInfo | null>,
};

contextBridge.exposeInMainWorld("desktop", api);
