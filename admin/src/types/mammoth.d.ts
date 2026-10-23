declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export interface MammothOptions {
    styleMap?: string[] | string;
    includeDefaultStyleMap?: boolean;
    convertImage?: any;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
  }

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: MammothOptions
  ): Promise<MammothResult>;

  export const images: {
    imgElement: (
      func: (element: {
        contentType: string;
        read: (encoding?: string) => Promise<any>;
        altText?: string;
      }) => Promise<{ src: string } | Record<string, string>>
    ) => any;
  };

  const mammoth: {
    convertToHtml: typeof convertToHtml;
    images: typeof images;
  };

  export default mammoth;
}
