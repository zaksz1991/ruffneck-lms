"use client";

import { FormEvent, useEffect, useState } from "react";

type Course = {
  id: string;
  title: string;
  slug: string;
  price_ngn: number;
  status: string;
};

type Discount = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  course_id: string | null;
  minimum_amount: number | null;
  maximum_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_student_limit: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  discounts?: Discount[];
  courses?: Course[];
  error?: string;
};

type FormState = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  courseId: string;
  minimumAmount: string;
  maximumDiscount: string;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perStudentLimit: string;
  isActive: boolean;
  description: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  discountType: "percentage",
  discountValue: "",
  courseId: "",
  minimumAmount: "",
  maximumDiscount: "",
  startsAt: "",
  expiresAt: "",
  usageLimit: "",
  perStudentLimit: "1",
  isActive: true,
  description: "",
};

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function toDateTimeLocal(
  value: string | null
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000
  );

  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

export default function AdminDiscountManager() {
  const [discounts, setDiscounts] = useState<
    Discount[]
  >([]);

  const [courses, setCourses] = useState<Course[]>(
    []
  );

  const [form, setForm] =
    useState<FormState>(EMPTY_FORM);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  async function loadDiscounts() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/discounts",
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load discount codes."
        );
      }

      setDiscounts(data.discounts ?? []);
      setCourses(data.courses ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load discount codes."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDiscounts();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setMessage(null);
  }

  function startEdit(discount: Discount) {
    setEditingId(discount.id);

    setForm({
      code: discount.code,
      discountType:
        discount.discount_type,
      discountValue:
        String(discount.discount_value),
      courseId:
        discount.course_id ?? "",
      minimumAmount:
        discount.minimum_amount !== null
          ? String(discount.minimum_amount)
          : "",
      maximumDiscount:
        discount.maximum_discount !== null
          ? String(discount.maximum_discount)
          : "",
      startsAt: toDateTimeLocal(
        discount.starts_at
      ),
      expiresAt: toDateTimeLocal(
        discount.expires_at
      ),
      usageLimit:
        discount.usage_limit !== null
          ? String(discount.usage_limit)
          : "",
      perStudentLimit:
        String(discount.per_student_limit),
      isActive: discount.is_active,
      description:
        discount.description ?? "",
    });

    setMessage(null);
    setError(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveDiscount(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      ...(editingId
        ? { id: editingId }
        : {}),
      code: form.code.trim().toUpperCase(),
      discountType:
        form.discountType,
      discountValue:
        Number(form.discountValue),
      courseId:
        form.courseId || null,
      minimumAmount:
        form.minimumAmount
          ? Number(form.minimumAmount)
          : null,
      maximumDiscount:
        form.maximumDiscount
          ? Number(form.maximumDiscount)
          : null,
      startsAt:
        toIsoOrNull(form.startsAt),
      expiresAt:
        toIsoOrNull(form.expiresAt),
      usageLimit:
        form.usageLimit
          ? Number(form.usageLimit)
          : null,
      perStudentLimit:
        Number(form.perStudentLimit || 1),
      isActive: form.isActive,
      description:
        form.description.trim() || null,
    };

    try {
      const response = await fetch(
        "/api/admin/discounts",
        {
          method: editingId
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save discount code."
        );
      }

      setMessage(
        editingId
          ? "Discount code updated successfully."
          : "Discount code created successfully."
      );

      resetForm();

      await loadDiscounts();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save discount code."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleDiscount(
    discount: Discount
  ) {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/discounts",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: discount.id,
            code: discount.code,
            discountType:
              discount.discount_type,
            discountValue:
              discount.discount_value,
            courseId:
              discount.course_id,
            minimumAmount:
              discount.minimum_amount,
            maximumDiscount:
              discount.maximum_discount,
            startsAt:
              discount.starts_at,
            expiresAt:
              discount.expires_at,
            usageLimit:
              discount.usage_limit,
            perStudentLimit:
              discount.per_student_limit,
            isActive:
              !discount.is_active,
            description:
              discount.description,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update discount code."
        );
      }

      setMessage(
        discount.is_active
          ? "Discount code deactivated."
          : "Discount code activated."
      );

      await loadDiscounts();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update discount code."
      );
    }
  }

  async function deleteDiscount(
    discount: Discount
  ) {
    if (discount.usage_count > 0) {
      setError(
        "A used discount code cannot be deleted. Deactivate it instead."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete discount code "${discount.code}"?`
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/discounts?id=${encodeURIComponent(
          discount.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete discount code."
        );
      }

      setMessage(
        "Discount code deleted successfully."
      );

      if (editingId === discount.id) {
        resetForm();
      }

      await loadDiscounts();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete discount code."
      );
    }
  }

  function getCourseName(
    courseId: string | null
  ) {
    if (!courseId) {
      return "All eligible courses";
    }

    return (
      courses.find(
        (course) =>
          course.id === courseId
      )?.title ??
      "Course unavailable"
    );
  }

  function formatDiscount(
    discount: Discount
  ) {
    return discount.discount_type ===
      "percentage"
      ? `${discount.discount_value}%`
      : formatNaira(
          discount.discount_value
        );
  }

  if (loading) {
    return (
      <section className="admin-card">
        <p>
          Loading discount management...
        </p>
      </section>
    );
  }

  return (
    <div className="rn-discount-admin">
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              {editingId
                ? "Edit Discount Code"
                : "Create Discount Code"}
            </h2>

            <p>
              Create percentage or fixed
              discounts for published paid
              courses.
            </p>
          </div>

          {editingId ? (
            <button
              type="button"
              className="btn"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form
          className="rn-discount-admin-form"
          onSubmit={saveDiscount}
        >
          <div className="rn-discount-admin-grid">
            <label>
              Discount code
              <input
                type="text"
                value={form.code}
                onChange={(event) =>
                  updateField(
                    "code",
                    event.target.value.toUpperCase()
                  )
                }
                placeholder="WELCOME20"
                maxLength={100}
                required
              />
            </label>

            <label>
              Discount type
              <select
                value={form.discountType}
                onChange={(event) =>
                  updateField(
                    "discountType",
                    event.target.value as
                      | "percentage"
                      | "fixed"
                  )
                }
              >
                <option value="percentage">
                  Percentage
                </option>
                <option value="fixed">
                  Fixed amount
                </option>
              </select>
            </label>

            <label>
              Discount value
              <input
                type="number"
                min="1"
                max={
                  form.discountType ===
                  "percentage"
                    ? "100"
                    : undefined
                }
                value={form.discountValue}
                onChange={(event) =>
                  updateField(
                    "discountValue",
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Course
              <select
                value={form.courseId}
                onChange={(event) =>
                  updateField(
                    "courseId",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All eligible courses
                </option>

                {courses.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.title} —{" "}
                    {formatNaira(
                      course.price_ngn
                    )}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Minimum amount
              <input
                type="number"
                min="1"
                value={form.minimumAmount}
                onChange={(event) =>
                  updateField(
                    "minimumAmount",
                    event.target.value
                  )
                }
                placeholder="Optional"
              />
            </label>

            <label>
              Maximum discount
              <input
                type="number"
                min="1"
                value={form.maximumDiscount}
                onChange={(event) =>
                  updateField(
                    "maximumDiscount",
                    event.target.value
                  )
                }
                placeholder="Optional"
              />
            </label>

            <label>
              Usage limit
              <input
                type="number"
                min="1"
                value={form.usageLimit}
                onChange={(event) =>
                  updateField(
                    "usageLimit",
                    event.target.value
                  )
                }
                placeholder="Unlimited"
              />
            </label>

            <label>
              Per-student limit
              <input
                type="number"
                min="1"
                value={
                  form.perStudentLimit
                }
                onChange={(event) =>
                  updateField(
                    "perStudentLimit",
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Starts
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  updateField(
                    "startsAt",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Expires
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) =>
                  updateField(
                    "expiresAt",
                    event.target.value
                  )
                }
              />
            </label>

            <label className="rn-discount-admin-full">
              Description
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value
                  )
                }
                rows={3}
                maxLength={500}
                placeholder="Internal description for this promotion."
              />
            </label>
          </div>

          <label className="rn-discount-admin-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                updateField(
                  "isActive",
                  event.target.checked
                )
              }
            />
            Active
          </label>

          {error ? (
            <p className="rn-enroll-error">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="rn-discount-success">
              {message}
            </p>
          ) : null}

          <div className="rn-payment-history-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Discount"
                : "Create Discount"}
            </button>

            {editingId ? (
              <button
                type="button"
                className="btn"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              Existing Discount Codes
            </h2>

            <p>
              {discounts.length} code
              {discounts.length === 1
                ? ""
                : "s"} configured.
            </p>
          </div>
        </div>

        {discounts.length === 0 ? (
          <p>
            No discount codes have been
            created yet.
          </p>
        ) : (
          <div className="rn-discount-admin-list">
            {discounts.map((discount) => (
              <article
                key={discount.id}
                className="rn-discount-admin-item"
              >
                <div>
                  <div className="rn-discount-admin-title">
                    <strong>
                      {discount.code}
                    </strong>

                    <span
                      className={
                        discount.is_active
                          ? "rn-discount-success"
                          : "rn-enroll-error"
                      }
                    >
                      {discount.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <p>
                    {formatDiscount(
                      discount
                    )}{" "}
                    ·{" "}
                    {getCourseName(
                      discount.course_id
                    )}
                  </p>

                  {discount.description ? (
                    <p>
                      {discount.description}
                    </p>
                  ) : null}
                </div>

                <div className="rn-discount-admin-meta">
                  <span>
                    Used:{" "}
                    <strong>
                      {
                        discount.usage_count
                      }
                    }
                    {discount.usage_limit
                      ? ` / ${discount.usage_limit}`
                      : ""}
                  </span>

                  <span>
                    Per student:{" "}
                    <strong>
                      {
                        discount.per_student_limit
                      }
                    </strong>
                  </span>

                  <span>
                    Course:{" "}
                    <strong>
                      {getCourseName(
                        discount.course_id
                      )}
                    </strong>
                  </span>

                  {discount.expires_at ? (
                    <span>
                      Expires:{" "}
                      <strong>
                        {new Intl.DateTimeFormat(
                          "en-NG",
                          {
                            dateStyle:
                              "medium",
                            timeStyle:
                              "short",
                          }
                        ).format(
                          new Date(
                            discount.expires_at
                          )
                        )}
                      </strong>
                    </span>
                  ) : null}
                </div>

                <div className="rn-payment-history-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      startEdit(discount)
                    }
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      void toggleDiscount(
                        discount
                      )
                    }
                  >
                    {discount.is_active
                      ? "Deactivate"
                      : "Activate"}
                  </button>

                  {discount.usage_count ===
                  0 ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        void deleteDiscount(
                          discount
                        )
                      }
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}