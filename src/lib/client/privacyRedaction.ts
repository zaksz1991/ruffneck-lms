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

const REDACTION_LABELS = [
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
  /^(?:\+234|234|0)(?:70|71|80|81|90|91)\d{8}$/;

const INTERNATIONAL_PHONE_PATTERN =
  /^\+?\d[\d(). -]{8,18}$/;

const LONG_DIGIT_PATTERN =
  /^\d{10,20}$/;

const LONG_ID_PATTERN =
  /^(?=.*\d)[A-Z0-9-]{10,30}$/i;

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeToken(value: string) {
  return value
    .replace(/[^\w@.+/:-]/g, "")
    .trim();
}

function isSensitiveValue(
  text: string
) {
  const token = normalizeToken(text);

  if (!token) {
    return false;
  }

  if (
    EMAIL_PATTERN.test(token)
  ) {
    return true;
  }

  if (
    NIGERIAN_PHONE_PATTERN.test(
      token
    )
  ) {
    return true;
  }

  if (
    INTERNATIONAL_PHONE_PATTERN.test(
      token
    ) &&
    /\d{7,}/.test(token)
  ) {
    return true;
  }

  if (
    LONG_DIGIT_PATTERN.test(
      token
    )
  ) {
    return true;
  }

  if (
    LONG_ID_PATTERN.test(
      token
    )
  ) {
    return true;
  }

  return false;
}

function isLabel(
  text: string
) {
  const normalized =
    normalizeText(text);

  return REDACTION_LABELS.some(
    (label) =>
      normalized ===
      label
  );
}

function isStrongIdentifierLabel(
  text: string
) {
  const normalized =
    normalizeText(text);

  return (
    normalized ===
      "account" ||
    normalized ===
      "acct" ||
    normalized ===
      "bvn" ||
    normalized ===
      "nin" ||
    normalized ===
      "iban" ||
    normalized ===
      "card" ||
    normalized ===
      "phone" ||
    normalized ===
      "mobile" ||
    normalized ===
      "email" ||
    normalized ===
      "rrn" ||
    normalized ===
      "stan"
  );
}

function wordCenterY(
  word: WordRegion
) {
  return (
    word.bbox.y0 +
    word.bbox.y1
  ) / 2;
}

function sameLine(
  a: WordRegion,
  b: WordRegion
) {
  const aHeight =
    Math.max(
      8,
      a.bbox.y1 -
        a.bbox.y0
    );

  const bHeight =
    Math.max(
      8,
      b.bbox.y1 -
        b.bbox.y0
    );

  const tolerance =
    Math.max(
      8,
      Math.min(
        aHeight,
        bHeight
      ) * 0.7
    );

  return (
    Math.abs(
      wordCenterY(a) -
        wordCenterY(b)
    ) <= tolerance
  );
}

function sortWords(
  words: WordRegion[]
) {
  return [
    ...words,
  ].sort(
    (a, b) =>
      a.bbox.y0 -
        b.bbox.y0 ||
      a.bbox.x0 -
        b.bbox.x0
  );
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
    typeof value !==
    "object"
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

function expandBox(
  bbox: BoundingBox,
  paddingX = 8,
  paddingY = 8
): BoundingBox {
  return {
    x0: Math.max(
      0,
      bbox.x0 - paddingX
    ),
    y0: Math.max(
      0,
      bbox.y0 - paddingY
    ),
    x1:
      bbox.x1 + paddingX,
    y1:
      bbox.y1 + paddingY,
  };
}

function boxesOverlap(
  a: BoundingBox,
  b: BoundingBox
) {
  return (
    a.x0 <= b.x1 &&
    a.x1 >= b.x0 &&
    a.y0 <= b.y1 &&
    a.y1 >= b.y0
  );
}

function mergeBoxes(
  boxes: BoundingBox[]
) {
  const remaining = [
    ...boxes,
  ];

  const merged: BoundingBox[] =
    [];

  while (
    remaining.length > 0
  ) {
    let current =
      remaining.shift()!;

    let changed = true;

    while (changed) {
      changed = false;

      for (
        let index =
          remaining.length - 1;
        index >= 0;
        index -= 1
      ) {
        const candidate =
          remaining[index];

        const expanded: BoundingBox =
          {
            x0:
              current.x0 -
              4,
            y0:
              current.y0 -
              4,
            x1:
              current.x1 +
              4,
            y1:
              current.y1 +
              4,
          };

        if (
          boxesOverlap(
            expanded,
            candidate
          )
        ) {
          current = {
            x0: Math.min(
              current.x0,
              candidate.x0
            ),
            y0: Math.min(
              current.y0,
              candidate.y0
            ),
            x1: Math.max(
              current.x1,
              candidate.x1
            ),
            y1: Math.max(
              current.y1,
              candidate.y1
            ),
          };

          remaining.splice(
            index,
            1
          );

          changed = true;
        }
      }
    }

    merged.push(
      current
    );
  }

  return merged;
}

function findNextSameLineWord(
  words: WordRegion[],
  index: number
) {
  const current =
    words[index];

  for (
    let cursor =
      index + 1;
    cursor < words.length;
    cursor += 1
  ) {
    const candidate =
      words[cursor];

    if (
      candidate.bbox.x0 <=
      current.bbox.x1
    ) {
      continue;
    }

    if (
      sameLine(
        current,
        candidate
      )
    ) {
      return cursor;
    }

    /*
     * Once the OCR has moved below this word,
     * there is no useful next-line candidate.
     */
    if (
      candidate.bbox.y0 >
      current.bbox.y1 +
        Math.max(
          20,
          current.bbox.y1 -
            current.bbox.y0
        )
    ) {
      break;
    }
  }

  return -1;
}

function findFollowingValueWords(
  words: WordRegion[],
  labelIndex: number,
  maximumWords = 3
) {
  const label =
    words[labelIndex];

  const candidates: number[] =
    [];

  for (
    let cursor =
      labelIndex + 1;
    cursor < words.length &&
    candidates.length <
      maximumWords;
    cursor += 1
  ) {
    const candidate =
      words[cursor];

    if (
      !sameLine(
        label,
        candidate
      )
    ) {
      break;
    }

    if (
      candidate.bbox.x0 <
      label.bbox.x1
    ) {
      continue;
    }

    candidates.push(
      cursor
    );
  }

  return candidates;
}

function shouldMaskFollowingValue(
  labelText: string,
  candidateText: string
) {
  const label =
    normalizeText(
      labelText
    );

  const candidate =
    normalizeToken(
      candidateText
    );

  if (!candidate) {
    return false;
  }

  /*
   * Explicit account / identifier labels.
   */
  if (
    label ===
      "account" ||
    label ===
      "acct"
  ) {
    return (
      /^\d{6,20}$/.test(
        candidate
      ) ||
      /^[A-Z0-9-]{6,20}$/i.test(
        candidate
      )
    );
  }

  if (
    label ===
      "bvn" ||
    label ===
      "nin"
  ) {
    return (
      /\d{8,20}/.test(
        candidate
      )
    );
  }

  if (
    label ===
      "iban"
  ) {
    return (
      /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/i.test(
        candidate
      )
    );
  }

  if (
    label ===
      "card"
  ) {
    return (
      /(?:\d[ -]?){12,19}/.test(
        candidate
      )
    );
  }

  if (
    label ===
      "phone" ||
    label ===
      "mobile" ||
    label ===
      "telephone"
  ) {
    return (
      /\d{7,}/.test(
        candidate
      )
    );
  }

  if (
    label ===
      "email"
  ) {
    return (
      candidate.includes(
        "@"
      )
    );
  }

  if (
    label ===
      "rrn" ||
    label ===
      "stan"
  ) {
    return (
      candidate.length >=
      6
    );
  }

  if (
    label ===
      "transaction" ||
    label ===
      "transfer" ||
    label ===
      "payment" ||
    label ===
      "reference"
  ) {
    return (
      /^\d{8,20}$/.test(
        candidate
      ) ||
      LONG_ID_PATTERN.test(
        candidate
      )
    );
  }

  return false;
}

function addBox(
  boxes: BoundingBox[],
  word: WordRegion
) {
  boxes.push(
    expandBox(
      word.bbox
    )
  );
}

function detectSensitiveBoxes(
  words: WordRegion[]
) {
  const sorted =
    sortWords(words);

  const boxes: BoundingBox[] =
    [];

  /*
   * First pass:
   * catch obvious standalone sensitive values.
   */
  for (
    const word of sorted
  ) {
    const normalized =
      normalizeToken(
        word.text
      );

    if (
      EMAIL_PATTERN.test(
        normalized
      ) ||
      NIGERIAN_PHONE_PATTERN.test(
        normalized
      ) ||
      LONG_DIGIT_PATTERN.test(
        normalized
      )
    ) {
      addBox(
        boxes,
        word
      );
    }
  }

  /*
   * Second pass:
   * locate explicitly labelled sensitive fields and
   * redact only the value immediately following them.
   */
  for (
    let index = 0;
    index < sorted.length;
    index += 1
  ) {
    const word =
      sorted[index];

    if (
      !isLabel(
        word.text
      )
    ) {
      continue;
    }

    const following =
      findFollowingValueWords(
        sorted,
        index,
        isStrongIdentifierLabel(
          word.text
        )
          ? 3
          : 4
      );

    for (
      const candidateIndex of following
    ) {
      const candidate =
        sorted[
          candidateIndex
        ];

      if (
        isSensitiveValue(
          candidate.text
        ) &&
        shouldMaskFollowingValue(
          word.text,
          candidate.text
        )
      ) {
        addBox(
          boxes,
          candidate
        );
      }
    }

    /*
     * Common two-word labels:
     * "account number",
     * "transaction reference",
     * "reference number",
     * "beneficiary account",
     * etc.
     *
     * We inspect the next word and then the value.
     */
    const nextIndex =
      findNextSameLineWord(
        sorted,
        index
      );

    if (
      nextIndex !== -1
    ) {
      const nextWord =
        sorted[
          nextIndex
        ];

      const combinedLabel =
        `${normalizeText(
          word.text
        )} ${normalizeText(
          nextWord.text
        )}`;

      if (
        combinedLabel ===
          "account number" ||
        combinedLabel ===
          "account no" ||
        combinedLabel ===
          "transaction reference" ||
        combinedLabel ===
          "transaction number" ||
        combinedLabel ===
          "payment reference" ||
        combinedLabel ===
          "payment number" ||
        combinedLabel ===
          "reference number" ||
        combinedLabel ===
          "reference no" ||
        combinedLabel ===
          "beneficiary account" ||
        combinedLabel ===
          "recipient account" ||
        combinedLabel ===
          "sender account" ||
        combinedLabel ===
          "customer account" ||
        combinedLabel ===
          "phone number" ||
        combinedLabel ===
          "mobile number" ||
        combinedLabel ===
          "card number"
      ) {
        const values =
          findFollowingValueWords(
            sorted,
            nextIndex,
            3
          );

        for (
          const valueIndex of values
        ) {
          const valueWord =
            sorted[
              valueIndex
            ];

          if (
            isSensitiveValue(
              valueWord.text
            )
          ) {
            addBox(
              boxes,
              valueWord
            );

            /*
             * Once a likely identifier has been found,
             * do not mask the rest of the receipt line.
             */
            break;
          }
        }
      }
    }
  }

  return mergeBoxes(
    boxes
  );
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

      image.src =
        dataUrl;
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

  const recognition =
    await worker.recognize(
      dataUrl,
      {},
      {
        blocks: true,
      }
    );

  const resultData =
    (
      recognition as {
        data?: unknown;
      }
    ).data;

  const words =
    collectWordRegions(
      resultData
    );

  /*
   * We do not fail merely because OCR cannot find words.
   * The server-side sanitizer remains the second privacy barrier.
   */
  if (
    words.length === 0
  ) {
    return {
      dataUrl,
      redacted: false,
    };
  }

  const sensitiveBoxes =
    detectSensitiveBoxes(
      words
    );

  if (
    sensitiveBoxes.length ===
    0
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

  /*
   * Opaque masking is used instead of blur because blur can
   * leave sensitive characters partially recoverable.
   */
  context.save();

  context.fillStyle =
    "#ffffff";

  for (
    const box of sensitiveBoxes
  ) {
    context.fillRect(
      Math.max(
        0,
        box.x0
      ),
      Math.max(
        0,
        box.y0
      ),
      Math.max(
        1,
        Math.min(
          canvas.width,
          box.x1
        ) -
          Math.max(
            0,
            box.x0
          )
      ),
      Math.max(
        1,
        Math.min(
          canvas.height,
          box.y1
        ) -
          Math.max(
            0,
            box.y0
          )
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

  const worker =
    await createWorker(
      "eng"
    );

  try {
    const results: {
      dataUrl: string;
      redacted: boolean;
    }[] = [];

    for (
      const image of images
    ) {
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