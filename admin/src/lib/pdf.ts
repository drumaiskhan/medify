import * as pdfjs from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
export { pdfjs };
export const pdfOptions = {
  cMapUrl: "/pdf-assets/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdf-assets/standard_fonts/",
  wasmUrl: "/pdf-assets/wasm/",
  iccUrl: "/pdf-assets/iccs/",
  isEvalSupported: false,
};
export async function inspectPDF(file: File) {
  const task = pdfjs.getDocument({
    ...pdfOptions,
    data: await file.arrayBuffer(),
  });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({
      scale: 320 / page.getViewport({ scale: 1 }).width,
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.82),
    );
    return {
      pageCount: pdf.numPages,
      cover: blob
        ? new File([blob], "cover.jpg", { type: "image/jpeg" })
        : null,
    };
  } finally {
    await task.destroy();
  }
}
