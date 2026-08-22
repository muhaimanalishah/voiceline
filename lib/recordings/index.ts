import { RecordingStore } from "./types";
import { fsRecordingStore } from "./fs-store";
import { r2RecordingStore } from "./r2-store";

export * from "./types";
export * from "./fs-store";
export * from "./r2-store";

export function getRecordingStore(): RecordingStore {
  if (process.env.STORAGE_PROVIDER === "r2") {
    return r2RecordingStore;
  }
  return fsRecordingStore;
}

export const recordingStore: RecordingStore = {
  getAllRecordings: () => getRecordingStore().getAllRecordings(),
  getRecordingById: (id: string) => getRecordingStore().getRecordingById(id),
  updateTranscription: (id: string, newText: string, newTitle?: string) =>
    getRecordingStore().updateTranscription(id, newText, newTitle),
  updateRecording: (id: string, updates: { text?: string; title?: string }) => {
    const store = getRecordingStore();
    if (store.updateRecording) {
      return store.updateRecording(id, updates);
    }
    return store.updateTranscription(id, updates.text || "", updates.title);
  },
  deleteRecording: (id: string) => getRecordingStore().deleteRecording(id),
};
