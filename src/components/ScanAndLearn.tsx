"use client";

import { ChangeEvent, useRef, useState } from "react";

const MAX_PAGES = 5;
const TARGET_DATA_URL_LENGTH = 480_000;

const OUTPUT_TYPES = [
  ["lesson", "Full lesson"],
  ["study_guide", "Study guide"],
  ["lesson_plan", "Lesson plan"],
  ["revision_notes", "Revision notes"],
  ["quiz", "Quiz & assessment"],
  ["flashcards", "Flashcards"],
] as const;

const LANGUAGES = [
  ["en", "English"],
  ["ha", "Hausa"],
  ["yo", "Yoruba"],
  ["ig", "Igbo"],
  ["sw", "Swahili"],
] as const;

const AUDIENCES = [
  ["general", "General learning"],
  ["office", "Office / professional"],
  ["business", "Business / entrepreneurship"],
  ["education", "Education / teaching"],
  ["personal", "Personal productivity"],
] as const;

type OutputType = (typeof OUTPUT_TYPES)[number][0];
type LanguageCode = (typeof LANGUAGES)[number][0];
type Audience = (typeof AUDIENCES)[number][0];

type ScanImage = {
  id: string;
  name: string;
  dataUrl: string;
};

type LearningPack = {
  title: string;
  source_summary: string;
  extracted_text: string;
  learning_objectives: string[];
  prerequisites: string[];
  key_concepts: {
    term: string;
    explanation: string;
  }[];
  sections: {
    heading: string;
    content: string;
    examples: string[];
  }[];
  practical_activity: {
    title: string;
    instructions: string;
    expected_output: string;
  };
  assessment_questions: {
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  }[];
  study_plan: {
    step: number;
    action: string;
  }[];
  flashcards: {
    front: string;
    back: string;
  }[];
  source_warnings: string[];
  estimated_duration_minutes: number;
  difficulty: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  pack?: LearningPack;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read the image."));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("Unable to read the selected image."));
    };

    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("The selected image could not be processed."));
    image.src = dataUrl;
  });
}

async function compressImage(file: File) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("The selected image has no usable dimensions.");
  }

  let maxDimension = 1500;
  let quality = 0.68;
  let result = "";

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = Math.min(
      1,
      maxDimension / Math.max(sourceWidth, sourceHeight)
    );

    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser could not prepare the image.");
    }

    context.drawImage(image, 0, 0, width, height);
    result = canvas.toDataURL("image/jpeg", quality);

    if (result.length <= TARGET_DATA_URL_LENGTH) {
      return result;
    }

    maxDimension = Math.max(
      900,
      Math.round(maxDimension * 0.84)
    );

    quality = Math.max(
      0.48,
      quality - 0.07
    );
  }

  if (!result || result.length > TARGET_DATA_URL_LENGTH) {
    throw new Error(
      "This image is still too large after compression. Take the photo again with the page filling less of the frame."
    );
  }

  return result;
}

function makeImageId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function outputLabel(mode: OutputType) {
  return (
    OUTPUT_TYPES.find(
      ([value]) => value === mode
    )?.[1] || "Learning pack"
  );
}

function languageLabel(code: LanguageCode) {
  return (
    LANGUAGES.find(
      ([value]) => value === code
    )?.[1] || "English"
  );
}

function audienceLabel(audience: Audience) {
  return (
    AUDIENCES.find(
      ([value]) => value === audience
    )?.[1] || "General learning"
  );
}

export default function ScanAndLearn() {
  const cameraInputRef =
    useRef<HTMLInputElement>(null);

  const uploadInputRef =
    useRef<HTMLInputElement>(null);

  const [images, setImages] =
    useState<ScanImage[]>([]);

  const [mode, setMode] =
    useState<OutputType>("lesson");

  const [language, setLanguage] =
    useState<LanguageCode>("en");

  const [audience, setAudience] =
    useState<Audience>("general");

  const [focus, setFocus] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [pack, setPack] =
    useState<LearningPack | null>(null);

  async function handleFiles(
    fileList: FileList | null
  ) {
    if (!fileList?.length) {
      return;
    }

    setError(null);
    setPack(null);

    const remaining =
      MAX_PAGES - images.length;

    if (remaining <= 0) {
      setError(
        `You can add up to ${MAX_PAGES} pages per request.`
      );
      return;
    }

    const selectedFiles =
      Array.from(fileList).slice(
        0,
        remaining
      );

    const nextImages: ScanImage[] = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith("image/")) {
        setError(
          "Only image files are supported in this first scanner version."
        );
        continue;
      }

      if (file.size > 12 * 1024 * 1024) {
        setError(
          `${file.name} is too large. Use an image smaller than 12 MB.`
        );
        continue;
      }

      try {
        const dataUrl =
          await compressImage(file);

        nextImages.push({
          id: makeImageId(),
          name: file.name,
          dataUrl,
        });
      } catch (processingError) {
        setError(
          processingError instanceof Error
            ? processingError.message
            : `Unable to process ${file.name}.`
        );
      }
    }

    if (nextImages.length > 0) {
      setImages((current) => [
        ...current,
        ...nextImages,
      ]);
    }
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    void handleFiles(event.target.files);
    event.target.value = "";
  }

  function removeImage(id: string) {
    setImages((current) =>
      current.filter(
        (image) => image.id !== id
      )
    );

    setPack(null);
    setError(null);
  }

  function clearAll() {
    setImages([]);
    setPack(null);
    setError(null);
  }

  async function generateLearningPack() {
    if (loading) {
      return;
    }

    if (images.length === 0) {
      setError(
        "Capture or upload at least one page first."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setPack(null);

    try {
      const response = await fetch(
        "/api/student/scan",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            images: images.map(
              (image) => image.dataUrl
            ),
            mode,
            language,
            audience,
            focus: focus.trim(),
          }),
        }
      );

      let result: ApiResponse = {};

      try {
        result =
          (await response.json()) as ApiResponse;
      } catch {
        throw new Error(
          "The AI service returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to generate learning material."
        );
      }

      if (!result.pack) {
        throw new Error(
          "The AI service returned no learning material."
        );
      }

      setPack(result.pack);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate learning material."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyPack() {
    if (!pack) {
      return;
    }

    const text = [
      pack.title,
      "",
      pack.source_summary,
      "",
      "Learning objectives",
      ...pack.learning_objectives.map(
        (item) => `- ${item}`
      ),
      "",
      "Key concepts",
      ...pack.key_concepts.map(
        (item) =>
          `- ${item.term}: ${item.explanation}`
      ),
      "",
      ...pack.sections.flatMap(
        (section) => [
          section.heading,
          section.content,
          ...section.examples.map(
            (example) =>
              `Example: ${example}`
          ),
          "",
        ]
      ),
      "Practical activity",
      pack.practical_activity.title,
      pack.practical_activity.instructions,
      `Expected output: ${pack.practical_activity.expected_output}`,
      "",
      "Assessment",
      ...pack.assessment_questions.map(
        (question, index) =>
          `${index + 1}. ${question.question}\nAnswer: ${question.correct_answer}\n${question.explanation}`
      ),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(
        text
      );
    } catch {
      setError(
        "The learning pack could not be copied on this browser."
      );
    }
  }

  return (
    <main className="container rn-scan-shell">
      <section className="rn-scan-header">
        <div>
          <span className="rn-eyebrow">
            RUFFNECK LEARN AI
          </span>

          <h1>Scan & Learn</h1>

          <p>
            Capture handwritten notes,
            manuscripts, textbook pages or
            office documents and turn them into
            structured learning material.
          </p>
        </div>

        <div className="rn-scan-header-meta">
          <span>
            Up to {MAX_PAGES} pages
          </span>

          <span>
            English + African languages
          </span>
        </div>
      </section>

      <section className="rn-scan-grid">
        <div className="rn-scan-workspace">
          <section className="rn-scan-card">
            <div className="rn-scan-section-heading">
              <span className="rn-eyebrow">
                STEP 1
              </span>

              <h2>
                Capture your source
              </h2>

              <p>
                For handwritten material, keep the
                page flat, well lit and as clear as
                possible.
              </p>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={handleInputChange}
            />

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleInputChange}
            />

            <div className="rn-scan-source-actions">
              <button
                type="button"
                className="rn-button rn-button-primary"
                onClick={() =>
                  cameraInputRef.current?.click()
                }
                disabled={
                  loading ||
                  images.length >= MAX_PAGES
                }
              >
                Take photo
              </button>

              <button
                type="button"
                className="rn-button rn-button-secondary"
                onClick={() =>
                  uploadInputRef.current?.click()
                }
                disabled={
                  loading ||
                  images.length >= MAX_PAGES
                }
              >
                Upload pages
              </button>

              {images.length > 0 ? (
                <button
                  type="button"
                  className="rn-button rn-button-secondary"
                  onClick={clearAll}
                  disabled={loading}
                >
                  Clear all
                </button>
              ) : null}
            </div>

            {images.length > 0 ? (
              <div
                className="rn-scan-pages"
                aria-live="polite"
              >
                {images.map(
                  (image, index) => (
                    <article
                      key={image.id}
                      className="rn-scan-page-card"
                    >
                      <img
                        src={image.dataUrl}
                        alt={`Scanned page ${
                          index + 1
                        }`}
                      />

                      <div className="rn-scan-page-meta">
                        <div>
                          <strong>
                            Page {index + 1}
                          </strong>

                          <span>
                            {image.name}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="rn-button rn-button-secondary"
                          onClick={() =>
                            removeImage(
                              image.id
                            )
                          }
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <div className="rn-scan-empty">
                <strong>
                  No pages captured yet.
                </strong>

                <span>
                  Use the camera button on your
                  phone or upload image pages.
                </span>
              </div>
            )}
          </section>

          <section className="rn-scan-card">
            <div className="rn-scan-section-heading">
              <span className="rn-eyebrow">
                STEP 2
              </span>

              <h2>
                Choose the learning output
              </h2>
            </div>

            <div className="rn-scan-form-grid">
              <label>
                <span>Output</span>

                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(
                      event.target
                        .value as OutputType
                    )
                  }
                  disabled={loading}
                >
                  {OUTPUT_TYPES.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>Language</span>

                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(
                      event.target
                        .value as LanguageCode
                    )
                  }
                  disabled={loading}
                >
                  {LANGUAGES.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>Audience</span>

                <select
                  value={audience}
                  onChange={(event) =>
                    setAudience(
                      event.target
                        .value as Audience
                    )
                  }
                  disabled={loading}
                >
                  {AUDIENCES.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="rn-scan-full-field">
                <span>
                  Additional instruction
                </span>

                <textarea
                  value={focus}
                  onChange={(event) =>
                    setFocus(
                      event.target.value
                    )
                  }
                  maxLength={1500}
                  rows={5}
                  placeholder="Example: Make this suitable for a Nigerian office worker and include practical examples using Excel."
                  disabled={loading}
                />

                <small>
                  {focus.length} / 1,500
                </small>
              </label>
            </div>

            <div className="rn-scan-generate-row">
              <div>
                <strong>
                  Create: {outputLabel(mode)} ·{" "}
                  {languageLabel(language)}
                </strong>

                <span>
                  Audience:{" "}
                  {audienceLabel(
                    audience
                  )}
                </span>
              </div>

              <button
                type="button"
                className="rn-button rn-button-primary"
                onClick={
                  generateLearningPack
                }
                disabled={
                  loading ||
                  images.length === 0
                }
                aria-busy={loading}
              >
                {loading
                  ? "Creating learning pack…"
                  : "Create learning pack"}
              </button>
            </div>

            <p className="rn-scan-privacy-note">
              The first version processes the
              selected images through the
              server-side AI route and does not
              save the scanned images to the LMS
              database.
            </p>
          </section>
        </div>

        <aside className="rn-scan-guide">
          <section className="rn-scan-card">
            <span className="rn-eyebrow">
              WHAT IT CAN CREATE
            </span>

            <h2>
              From source page to learning
              material
            </h2>

            <div className="rn-scan-output-list">
              {[
                [
                  "Full lesson",
                  "Objectives, concepts, sections, examples, activity and assessment.",
                ],
                [
                  "Study guide",
                  "Structured review material from the source.",
                ],
                [
                  "Lesson plan",
                  "Teacher-ready structure with practical delivery steps.",
                ],
                [
                  "Revision notes",
                  "Focused learning points for revision.",
                ],
                [
                  "Quiz & assessment",
                  "Questions, options, answers and explanations.",
                ],
                [
                  "Flashcards",
                  "Compact prompt-and-answer revision cards.",
                ],
              ].map(
                ([title, description]) => (
                  <div key={title}>
                    <strong>
                      {title}
                    </strong>

                    <span>
                      {description}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rn-scan-card">
            <span className="rn-eyebrow">
              BETTER SCANS
            </span>

            <h2>
              For clearer results
            </h2>

            <ul className="rn-scan-tips">
              <li>
                Keep the whole page inside the
                camera frame.
              </li>

              <li>
                Use bright, even lighting and
                avoid shadows.
              </li>

              <li>
                Hold the phone parallel to the
                page.
              </li>

              <li>
                For handwriting, use the
                clearest pages first.
              </li>

              <li>
                Review AI-generated material
                before publishing it as a
                course.
              </li>
            </ul>
          </section>
        </aside>
      </section>

      {error ? (
        <div
          className="rn-scan-message rn-scan-message-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {pack ? (
        <section
          className="rn-scan-result"
          aria-live="polite"
        >
          <div className="rn-scan-result-header">
            <div>
              <span className="rn-eyebrow">
                GENERATED DRAFT
              </span>

              <h2>{pack.title}</h2>

              <p>
                {pack.source_summary}
              </p>
            </div>

            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={copyPack}
            >
              Copy learning pack
            </button>
          </div>

          {pack.source_warnings.length >
          0 ? (
            <div className="rn-scan-warning">
              <strong>
                Source warnings
              </strong>

              <ul>
                {pack.source_warnings.map(
                  (warning) => (
                    <li key={warning}>
                      {warning}
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}

          <div className="rn-scan-result-grid">
            <section className="rn-scan-result-card">
              <span className="rn-eyebrow">
                OBJECTIVES
              </span>

              <h3>
                Learning objectives
              </h3>

              <ul>
                {pack.learning_objectives.map(
                  (item) => (
                    <li key={item}>
                      {item}
                    </li>
                  )
                )}
              </ul>
            </section>

            <section className="rn-scan-result-card">
              <span className="rn-eyebrow">
                REQUIREMENTS
              </span>

              <h3>
                Learning requirements
              </h3>

              <p>
                <strong>
                  Difficulty:
                </strong>{" "}
                {pack.difficulty}
              </p>

              <p>
                <strong>
                  Estimated duration:
                </strong>{" "}
                {
                  pack.estimated_duration_minutes
                }{" "}
                minutes
              </p>

              <p>
                <strong>
                  Prerequisites:
                </strong>{" "}
                {pack.prerequisites.join(
                  ", "
                ) ||
                  "None specified"}
              </p>
            </section>
          </div>

          <section className="rn-scan-result-card">
            <span className="rn-eyebrow">
              KEY CONCEPTS
            </span>

            <h3>
              Key concepts
            </h3>

            <div className="rn-scan-concepts">
              {pack.key_concepts.map(
                (concept) => (
                  <div
                    key={concept.term}
                  >
                    <strong>
                      {concept.term}
                    </strong>

                    <span>
                      {concept.explanation}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rn-scan-result-card">
            <span className="rn-eyebrow">
              CONTENT
            </span>

            <h3>
              Structured lesson material
            </h3>

            <div className="rn-scan-sections">
              {pack.sections.map(
                (section) => (
                  <article
                    key={
                      section.heading
                    }
                  >
                    <h4>
                      {section.heading}
                    </h4>

                    <p>
                      {section.content}
                    </p>

                    {section
                      .examples
                      .length >
                    0 ? (
                      <ul>
                        {section.examples.map(
                          (example) => (
                            <li
                              key={
                                example
                              }
                            >
                              {example}
                            </li>
                          )
                        )}
                      </ul>
                    ) : null}
                  </article>
                )
              )}
            </div>
          </section>

          <section className="rn-scan-result-card">
            <span className="rn-eyebrow">
              PRACTICAL APPLICATION
            </span>

            <h3>
              {
                pack
                  .practical_activity
                  .title
              }
            </h3>

            <p>
              {
                pack
                  .practical_activity
                  .instructions
              }
            </p>

            <p>
              <strong>
                Expected output:
              </strong>{" "}
              {
                pack
                  .practical_activity
                  .expected_output
              }
            </p>
          </section>

          <section className="rn-scan-result-card">
            <span className="rn-eyebrow">
              ASSESSMENT
            </span>

            <h3>
              Knowledge check
            </h3>

            <div className="rn-scan-assessment-list">
              {pack.assessment_questions.map(
                (question, index) => (
                  <article
                    key={`${question.question}-${index}`}
                  >
                    <strong>
                      {index + 1}.{" "}
                      {question.question}
                    </strong>

                    {question.options
                      .length >
                    0 ? (
                      <ul>
                        {question.options.map(
                          (option) => (
                            <li
                              key={
                                option
                              }
                            >
                              {option}
                            </li>
                          )
                        )}
                      </ul>
                    ) : null}

                    <p>
                      <strong>
                        Answer:
                      </strong>{" "}
                      {
                        question.correct_answer
                      }
                    </p>

                    <p>
                      {
                        question.explanation
                      }
                    </p>
                  </article>
                )
              )}
            </div>
          </section>

          {pack.flashcards.length >
          0 ? (
            <section className="rn-scan-result-card">
              <span className="rn-eyebrow">
                REVISION
              </span>

              <h3>
                Flashcards
              </h3>

              <div className="rn-scan-flashcards">
                {pack.flashcards.map(
                  (card, index) => (
                    <article
                      key={`${card.front}-${index}`}
                    >
                      <strong>
                        {card.front}
                      </strong>

                      <span>
                        {card.back}
                      </span>
                    </article>
                  )
                )}
              </div>
            </section>
          ) : null}

          <section className="rn-scan-result-card">
            <span className="rn-eyebrow">
              STUDY PLAN
            </span>

            <h3>
              Recommended study path
            </h3>

            <ol>
              {pack.study_plan.map(
                (step) => (
                  <li
                    key={`${step.step}-${step.action}`}
                  >
                    {step.action}
                  </li>
                )
              )}
            </ol>
          </section>

          {pack.extracted_text ? (
            <details className="rn-scan-source-text">
              <summary>
                Review extracted source text
              </summary>

              <pre>
                {pack.extracted_text}
              </pre>
            </details>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}