import { apiBase, authHeaders } from "./client";
export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  yearId: string;
  category: string;
  published: boolean;
  isFree: boolean;
  pageCount: number;
  fileBytes: number;
  hasCover: boolean;
  canRead: boolean;
  updatedAt: string;
  page?: number;
  favorite?: boolean;
  lastRead?: string;
}
export interface Mark {
  id: string;
  page: number;
  kind: "bookmark" | "note" | "highlight" | "ink";
  data: {
    text?: string;
    color?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    points?: number[][];
    penWidth?: number;
  };
}
export const coverURL = (b: Book) =>
  `${apiBase()}/books/${b.id}/cover?v=${encodeURIComponent(b.updatedAt)}`;
export function uploadBook(
  data: FormData,
  id: string | undefined,
  onProgress: (n: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiBase() + "/admin/books" + (id ? "/" + id : ""));
    xhr.withCredentials = true;
    Object.entries(authHeaders()).forEach(([k,v])=>xhr.setRequestHeader(k,v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection."));
    xhr.onload = () => {
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        return reject(
          new Error(
            "Server rejected the upload. Check the hosting upload limit.",
          ),
        );
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(result);
      else reject(new Error(result.error || "Upload failed"));
    };
    xhr.send(data);
  });
}
