"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
electron.contextBridge.exposeInMainWorld("timerAPI", {
  startTimer: (taskName) => electron.ipcRenderer.invoke("timer:start", taskName),
  stopTimer: (id) => electron.ipcRenderer.invoke("timer:stop", id),
  getActiveTimer: () => electron.ipcRenderer.invoke("timer:get-active")
});
electron.contextBridge.exposeInMainWorld("entriesAPI", {
  getAllEntries: (limit, offset) => electron.ipcRenderer.invoke("entries:get-all", limit, offset),
  getEntryById: (id) => electron.ipcRenderer.invoke("entries:get-by-id", id),
  updateEntry: (id, updates) => electron.ipcRenderer.invoke("entries:update", id, updates),
  deleteEntry: (id) => electron.ipcRenderer.invoke("entries:delete", id),
  getEntriesInRange: (startDate, endDate) => electron.ipcRenderer.invoke("entries:get-range", startDate, endDate)
});
electron.contextBridge.exposeInMainWorld("databaseAPI", {
  getInfo: () => electron.ipcRenderer.invoke("db:info")
});
