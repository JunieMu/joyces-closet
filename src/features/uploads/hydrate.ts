import { useClosetStore } from "../closet/useClosetStore";
import { toClosetItem } from "./toClosetItem";
import { uploadStore } from "./uploadStore";

export async function hydrateCloset(): Promise<void> {
  const records = await uploadStore.list();
  useClosetStore.getState().setUploads(records.map(toClosetItem));
}
