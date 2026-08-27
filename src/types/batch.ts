import { PhotoItem } from "./listing";

export type BatchItem = {
  id: string;
  label: string;
  photos: PhotoItem[];
  barcode?: string;
  voiceNotes?: string;
};
