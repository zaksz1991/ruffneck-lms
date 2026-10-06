"use client";

import { FormEvent, useEffect, useState } from "react";

type DiscountType =
  | "percentage"
  | "fixed";

type Course = {
  id: string;
  title: string;
  slug: string;
  price_ngn: number | null;
  status: string;
};

type Discount = {
  id: string;
  code: string;
  discount_type: DiscountType;
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
};

type FormState = {
  code: string;
  discountType: DiscountType;
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

const emptyForm: FormState = {
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

function formatMoney(
  amount: number | null
) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "No expiry";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function toInputDateTime(
  value: string | null
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  const pad = (number: number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formFromDiscount(
  discount: Discount
): FormState {
  return {
    code: discount.code,
    discountType:
      discount.discount_type,
    discountValue: String(
      discount.discount_value
    ),
    courseId:
      discount.course_id || "",
    minimumAmount:
      discount.minimum_amount
        ? String(discount.minimum_amount)
        : "",
    maximumDiscount:
      discount.maximum_discount
        ? String(
            discount.maximum_discount
          )
        : "",
    startsAt: toInputDateTime(
      discount.starts_at
    ),
    expiresAt: toInputDateTime(
      discount.expires_at
    ),
    usageLimit:
      discount.usage_limit
        ? String(discount.usage_limit)
        : "",
    perStudentLimit: String(
      discount.per_student_limit
    ),
    isActive: discount.is_active,
    description:
      discount.description || "",
  };
}

export default function AdminDiscountManager() {
  const [discounts, setDiscounts] =
    useState<Discount[]>([]);

  const [courses, setCourses] =
    useState<Course[]>([]);

  const [form, setForm] =
    useState<FormState>(emptyForm);

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

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/discounts",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

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
    void load();
  }, []);

  function updateField<
    K extends keyof FormState
  >(
    key: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setMessage(null);
  }

  function editDiscount(
    discount: Discount
  ) {
    setEditingId(discount.id);
    setForm(
      formFromDiscount(discount)
    );
    setError(null);
    setMessage(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function save(
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
      code: form.code,
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
          ? Number(
              form.maximumDiscount
            )
          : null,
      startsAt:
        form.startsAt
          ? new Date(
              form.startsAt
            ).toISOString()
          : null,
      expiresAt:
        form.expiresAt
          ? new Date(
              form.expiresAt
            ).toISOString()
          : null,
      usageLimit:
        form.usageLimit
          ? Number(form.usageLimit)
          : null,
      perStudentLimit:
        Number(form.perStudentLimit),
      isActive: form.isActive,
      description:
        form.description || null,
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
          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await response.json();

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
      await load();
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
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update discount."
        );
      }

      await load();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update discount."
      );
    }
  }

  async function deleteDiscount(
    discount: Discount
  ) {
    if (
      !window.confirm(
        `Delete discount code ${discount.code}?`
      )
    ) {
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
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete discount."
        );
      }

      setMessage(
        "Discount code deleted successfully."
      );

      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete discount."
      );
    }
  }

  return (
    <>
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              {editingId
                ? "Edit Discount Code"
                : "Create Discount Code"}
            </h2>

            <p>
              Configure how the code can be
              used and where it applies.
            </p>
          </div>

          {editingId ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form
          onSubmit={save}
          className="rn-discount-admin-form"
        >
          <div className="rn-discount-admin-grid">
            <label>
              Code
              <input
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
                value={
                  form.discountType
                }
                onChange={(event) =>
                  updateField(
                    "discountType",
                    event.target
                      .value as DiscountType
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
                value={
                  form.discountValue
                }
                onChange={(event) =>
                  updateField(
                    "discountValue",
                    event.target.value
                  )
                }
                placeholder={
                  form.discountType ===
                  "percentage"
                    ? "20"
                    : "5000"
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
                  All eligible paid courses
                </option>

                {courses.map(
                  (course) => (
                    <option
                      key={course.id}
                      value={course.id}
                    >
                      {course.title} —{" "}
                      {formatMoney(
                        course.price_ngn
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Minimum purchase
              <input
                type="number"
                min="1"
                value={
                  form.minimumAmount
                }
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
                value={
                  form.maximumDiscount
                }
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
                value={
                  form.usageLimit
                }
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
                value={
                  form.expiresAt
                }
                onChange={(event) =>
                  updateField(
                    "expiresAt",
                    event.target.value
                  )
                }
              />
            </label>
          </div>

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

            <span>
              Active discount code
            </span>
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

          <div className="admin-page-actions">
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
                className="btn btn-secondary"
                onClick={resetForm}
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
            <h2>Discount Codes</h2>

            <p>
              {discounts.length} configured
              promotion
              {discounts.length === 1
                ? ""
                : "s"}
              .
            </p>
          </div>
        </div>

        {loading ? (
          <p>Loading discount codes...</p>
        ) : discounts.length === 0 ? (
          <div className="rn-empty-state">
            <strong>
              No discount codes yet.
            </strong>

            <p>
              Create your first promotional
              code above.
            </p>
          </div>
        ) : (
          <div className="rn-discount-admin-list">
            {discounts.map(
              (discount) => {
                const course =
                  courses.find(
                    (item) =>
                      item.id ===
                      discount.course_id
                  );

                const usageText =
                  discount.usage_limit
                    ? `${discount.usage_count} / ${discount.usage_limit}`
                    : `${discount.usage_count} used`;

                return (
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
                              ? "rn-payment-status rn-payment-status-successful"
                              : "rn-payment-status rn-payment-status-cancelled"
                          }
                        >
                          {discount.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                      <p>
                        {discount.discount_type ===
                        "percentage"
                          ? `${discount.discount_value}% off`
                          : `${formatMoney(
                              discount.discount_value
                            )} off`}
                        {" · "}
                        {course
                          ? course.title
                          : "All eligible paid courses"}
                      </p>

                      {discount.description ? (
                        <p>
                          {
                            discount.description
                          }
                        </p>
                      ) : null}
                    </div>

                    <div className="rn-discount-admin-meta">
                      <span>
                        Usage:{" "}
                        <strong>
                          {usageText}
                        </strong>
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
                        Expires:{" "}
                        <strong>
                          {formatDate(
                            discount.expires_at
                          )}
                        </strong>
                      </span>
                    </div>

                    <div className="rn-payment-history-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          editDiscount(
                            discount
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          toggleDiscount(
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
                          className="btn btn-secondary"
                          onClick={() =>
                            deleteDiscount(
                              discount
                            )
                          }
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </>
  );
}