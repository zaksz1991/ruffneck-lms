import { createWorker } from "tesseract.js";

type BoundingBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type WordRegion = {
  text: string;
  bbox: BoundingBox;
};

const REDACTION_TERMS = [
  "account",
  "acct",
  "beneficiary",
  "recipient",
  "sender",
  "customer",
  "transaction",
  "transfer",
  "payment",
  "reference",
  "phone",
  "mobile",
  "telephone",
  "email",
  "bvn",
  "nin",
  "iban",
  "card",
  "cvv",
  "cvc",
  "pin",
  "rrn",
  "stan",
];

const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const NIGERIAN_PHONE_PATTERN =
  /\b(?:\+234|234|0)(?:70|71|80|81|90|91)\d{8}\b/;

const LONG_DIGIT_PATTERN =
  /\b\d{6,20}\b/;

const ALPHANUMERIC_ID_PATTERN =
  /\b[A-Z0-9][A-Z0-9-]{7,}\b/i;

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function containsSensitiveTerm(text: string) {
  const normalized = normalizeText(text);

  return REDACTION_TERMS.some((term) =>
    new RegExp(
      `\\b${term}\\b`,
      "i"
    ).test(normalized)
  );
}

function containsSensitiveValue(text: string) {
  return (
    EMAIL_PATTERN.test(text) ||
    NIGERIAN_PHONE_PATTERN.test(text) ||
    LONG_DIGIT_PATTERN.test(text) ||
    ALPHANUMERIC_ID_PATTERN.test(text)
  );
}

function shouldRedactLine(text: string) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return false;
  }

  /*
   * An email or Nigerian phone number is sensitive by itself.
   */
  if (
    EMAIL_PATTERN.test(text) ||
    NIGERIAN_PHONE_PATTERN.test(text)
  ) {
    return true;
  }

  /*
   * Explicit privacy labels combined with a likely value.
   */
  if (
    containsSensitiveTerm(
      normalized
    ) &&
    containsSensitiveValue(
      normalized
    )
  ) {
    return true;
  }

  /*
   * Strong identifier patterns are also redacted when detected.
   */
  if (
    /\b(?:bvn|nin)\b/i.test(
      normalized
    ) &&
    /\d{8,}/.test(normalized)
  ) {
    return true;
  }

  return false;
}

function collectWordRegions(
  value: unknown,
  output: WordRegion[] = []
): WordRegion[] {
  if (!value) {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectWordRegions(
        item,
        output
      );
    }

    return output;
  }

  if (
    typeof value !== "object"
  ) {
    return output;
  }

  const item =
    value as Record<
      string,
      unknown
    >;

  const text =
    typeof item.text ===
    "string"
      ? item.text.trim()
      : "";

  const rawBbox =
    item.bbox;

  if (
    text &&
    rawBbox &&
    typeof rawBbox ===
      "object" &&
    !Array.isArray(rawBbox)
  ) {
    const bbox =
      rawBbox as Record<
        string,
        unknown
      >;

    if (
      typeof bbox.x0 ===
        "number" &&
      typeof bbox.y0 ===
        "number" &&
      typeof bbox.x1 ===
        "number" &&
      typeof bbox.y1 ===
        "number"
    ) {
      output.push({
        text,
        bbox: {
          x0: bbox.x0,
          y0: bbox.y0,
          x1: bbox.x1,
          y1: bbox.y1,
        },
      });
    }
  }

  for (const child of Object.values(
    item
  )) {
    if (
      typeof child ===
        "object" &&
      child !== null
    ) {
      collectWordRegions(
        child,
        output
      );
    }
  }

  return output;
}

function groupWordsIntoLines(
  words: WordRegion[]
) {
  const lines: WordRegion[][] = [];

  const sorted = [
    ...words,
  ].sort(
    (a, b) =>
      a.bbox.y0 -
        b.bbox.y0 ||
      a.bbox.x0 -
        b.bbox.x0
  );

  for (const word of sorted) {
    const centerY =
      (word.bbox.y0 +
        word.bbox.y1) /
      2;

    const existing =
      lines.find(
        (line) => {
          const first =
            line[0];

          const firstCenterY =
            (first.bbox.y0 +
              first.bbox.y1) /
            2;

          const averageHeight =
            Math.max(
              12,
              (first.bbox.y1 -
                first.bbox.y0)
            );

          return (
            Math.abs(
              centerY -
                firstCenterY
            ) <=
            averageHeight *
              0.65
          );
        }
      );

    if (existing) {
      existing.push(word);
    } else {
      lines.push([
        word,
      ]);
    }
  }

  return lines;
}

function lineText(
  words: WordRegion[]
) {
  return [...words]
    .sort(
      (a, b) =>
        a.bbox.x0 -
        b.bbox.x0
    )
    .map(
      (word) =>
        word.text
    )
    .join(" ");
}

function expandBox(
  bbox: BoundingBox,
  padding = 12
): BoundingBox {
  return {
    x0: Math.max(
      0,
      bbox.x0 - padding
    ),
    y0: Math.max(
      0,
      bbox.y0 - padding
    ),
    x1:
      bbox.x1 + padding,
    y1:
      bbox.y1 + padding,
  };
}

function mergeBoxes(
  boxes: BoundingBox[]
) {
  if (boxes.length === 0) {
    return [];
  }

  const sorted = [
    ...boxes,
  ].sort(
    (a, b) =>
      a.y0 - b.y0 ||
      a.x0 - b.x0
  );

  const merged: BoundingBox[] =
    [];

  for (const box of sorted) {
    const previous =
      merged[
        merged.length - 1
      ];

    if (!previous) {
      merged.push({
        ...box,
      });
      continue;
    }

    const overlapsVertically =
      box.y0 <=
        previous.y1 + 8 &&
      box.y1 >=
        previous.y0 - 8;

    const overlapsHorizontally =
      box.x0 <=
        previous.x1 + 24;

    if (
      overlapsVertically &&
      overlapsHorizontally
    ) {
      previous.x0 =
        Math.min(
          previous.x0,
          box.x0
        );

      previous.y0 =
        Math.min(
          previous.y0,
          box.y0
        );

      previous.x1 =
        Math.max(
          previous.x1,
          box.x1
        );

      previous.y1 =
        Math.max(
          previous.y1,
          box.y1
        );
    } else {
      merged.push({
        ...box,
      });
    }
  }

  return merged;
}

function loadImage(
  dataUrl: string
) {
  return new Promise<HTMLImageElement>(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image();

      image.onload = () =>
        resolve(image);

      image.onerror = () =>
        reject(
          new Error(
            "The image could not be loaded for privacy screening."
          )
        );

      image.src = dataUrl;
    }
  );
}

async function redactOneImage(
  worker: Awaited<
    ReturnType<
      typeof createWorker
    >
  >,
  dataUrl: string
) {
  const image =
    await loadImage(
      dataUrl
    );

  /*
   * Tesseract.js supports structured block output,
   * including text and bounding boxes. :contentReference[oaicite:2]{index=2}
   */
  const recognition =
    await worker.recognize(
      dataUrl,
      {},
      {
        blocks: true,
      }
    );

  const words =
    collectWordRegions(
      (
        recognition as {
          data?: unknown;
        }
      ).data
    );

  if (
    words.length === 0
  ) {
    /*
     * Fail closed. We do not send an uninspected image
     * to Gemini when the privacy scanner cannot read it.
     */
    throw new Error(
      "Privacy screening could not read this page. Please retake the photo with better lighting and clearer focus."
    );
  }

  const lines =
    groupWordsIntoLines(
      words
    );

  const boxes: BoundingBox[] =
    [];

  for (const line of lines) {
    const text =
      lineText(line);

    if (
      shouldRedactLine(
        text
      )
    ) {
      const lineBox =
        line.reduce(
          (
            combined,
            word
          ) => ({
            x0: Math.min(
              combined.x0,
              word.bbox.x0
            ),
            y0: Math.min(
              combined.y0,
              word.bbox.y0
            ),
            x1: Math.max(
              combined.x1,
              word.bbox.x1
            ),
            y1: Math.max(
              combined.y1,
              word.bbox.y1
            ),
          }),
          {
            x0: Number.POSITIVE_INFINITY,
            y0: Number.POSITIVE_INFINITY,
            x1: 0,
            y1: 0,
          }
        );

      boxes.push(
        expandBox(
          lineBox,
          14
        )
      );
    }
  }

  const mergedBoxes =
    mergeBoxes(boxes);

  /*
   * Nothing suspicious was found.
   * Keep the image unchanged.
   */
  if (
    mergedBoxes.length === 0
  ) {
    return {
      dataUrl,
      redacted: false,
    };
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    image.naturalWidth ||
    image.width;

  canvas.height =
    image.naturalHeight ||
    image.height;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    throw new Error(
      "The browser could not prepare the privacy-redacted image."
    );
  }

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.save();

  /*
   * Use an opaque neutral mask rather than blur.
   * Blur can leave characters partially recoverable.
   */
  context.fillStyle =
    "#ffffff";

  for (const box of mergedBoxes) {
    context.fillRect(
      box.x0,
      box.y0,
      Math.max(
        1,
        box.x1 -
          box.x0
      ),
      Math.max(
        1,
        box.y1 -
          box.y0
      )
    );
  }

  context.restore();

  return {
    dataUrl:
      canvas.toDataURL(
        "image/jpeg",
        0.78
      ),

    redacted: true,
  };
}

export async function redactImagesBeforeGemini(
  images: string[]
) {
  if (
    images.length === 0
  ) {
    return {
      images: [],
      redactedCount: 0,
    };
  }

  /*
   * English is deliberately used for privacy screening.
   * The purpose here is identifier detection, not source
   * transcription. Numeric identifiers and common banking
   * labels are normally Latin-script.
   */
  const worker =
    await createWorker(
      "eng"
    );

  try {
    const results: {
      dataUrl: string;
      redacted: boolean;
    }[] = [];

    for (const image of images) {
      const result =
        await redactOneImage(
          worker,
          image
        );

      results.push(
        result
      );
    }

    return {
      images:
        results.map(
          (result) =>
            result.dataUrl
        ),

      redactedCount:
        results.filter(
          (result) =>
            result.redacted
        ).length,
    };
  } finally {
    await worker.terminate();
  }
}