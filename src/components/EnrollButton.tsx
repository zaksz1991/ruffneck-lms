"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type EnrollButtonProps = {
  courseId: string;
  courseSlug: string;
  firstLessonSlug: string | null;
  courseTitle: string;
  className?: string;
  label?: string;
};

type DiscountValidationResponse = {
  valid?: boolean;
  error?: string;
  originalAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  isFullDiscount?: boolean;
};

type EnrollmentResponse = {
  success?: boolean;
  already_enrolled?: boolean;
  alreadyEnrolled?: boolean;
  payment_required?: boolean;
  paymentRequired?: boolean;
  payment_url?: string;
  error?: string;
  originalAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  discountCode?: string;
  isFullDiscount?: boolean;
  enrollment?: {
    id: string;
    enrollment_status: string;
  };
};

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function EnrollButton({
  courseId,
  courseSlug,
  firstLessonSlug,
  courseTitle,
  className,
  label = "Enroll / Pay",
}: EnrollButtonProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [validatingDiscount, setValidatingDiscount] =
    useState(false);

  const [discountCode, setDiscountCode] = useState("");
  const [discountMessage, setDiscountMessage] =
    useState<string | null>(null);

  const [discountValid, setDiscountValid] =
    useState(false);

  const [pricing, setPricing] = useState<{
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  async function validateDiscount() {
    const code = discountCode.trim().toUpperCase();

    if (!code) {
      setDiscountMessage("Enter a discount code.");
      setDiscountValid(false);
      setPricing(null);
      return;
    }

    setValidatingDiscount(true);
    setDiscountMessage(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/student/discount/validate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courseSlug,
            discountCode: code,
          }),
        }
      );

      const data =
        (await response.json()) as DiscountValidationResponse;

      if (!response.ok || !data.valid) {
        setDiscountValid(false);
        setPricing(null);
        setDiscountMessage(
          data.error || "Invalid discount code."
        );
        return;
      }

      setDiscountCode(code);
      setDiscountValid(true);

      setPricing({
        originalAmount: data.originalAmount ?? 0,
        discountAmount: data.discountAmount ?? 0,
        finalAmount: data.finalAmount ?? 0,
      });

      setDiscountMessage(
        data.isFullDiscount
          ? "100% discount applied. This course will be enrolled for free."
          : "Discount applied successfully."
      );
    } catch {
      setDiscountValid(false);
      setPricing(null);
      setDiscountMessage(
        "Unable to validate the discount code."
      );
    } finally {
      setValidatingDiscount(false);
    }
  }

  async function enroll() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(
          `/login?next=/courses/${courseSlug}`
        );
        return;
      }

      const code = discountCode.trim().toUpperCase();

      const response = await fetch(
        "/api/student/enroll",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courseId,
            courseSlug,
            discountCode: code || undefined,
          }),
        }
      );

      const data =
        (await response.json()) as EnrollmentResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Unable to enroll in ${courseTitle}.`
        );
      }

      if (
        data.payment_required &&
        data.payment_url
      ) {
        window.location.assign(
          data.payment_url
        );
        return;
      }

      if (
        data.paymentRequired &&
        data.payment_url
      ) {
        window.location.assign(
          data.payment_url
        );
        return;
      }

      if (firstLessonSlug) {
        router.push(
          `/learn/${courseSlug}/${firstLessonSlug}`
        );
        return;
      }

      router.refresh();
    } catch (enrollmentError) {
      setError(
        enrollmentError instanceof Error
          ? enrollmentError.message
          : `Unable to enroll in ${courseTitle}.`
      );

      setLoading(false);
    }
  }

  return (
    <div className="rn-enroll-control">
      <div className="rn-discount-control">
        <label htmlFor={`discount-${courseId}`}>
          Discount code
        </label>

        <div className="rn-discount-row">
          <input
            id={`discount-${courseId}`}
            type="text"
            value={discountCode}
            onChange={(event) => {
              setDiscountCode(
                event.target.value.toUpperCase()
              );
              setDiscountValid(false);
              setPricing(null);
              setDiscountMessage(null);
            }}
            placeholder="Enter code"
            maxLength={100}
            autoComplete="off"
            disabled={loading || validatingDiscount}
          />

          <button
            type="button"
            onClick={validateDiscount}
            disabled={
              loading ||
              validatingDiscount ||
              !discountCode.trim()
            }
          >
            {validatingDiscount
              ? "Checking..."
              : "Apply"}
          </button>
        </div>

        {discountMessage ? (
          <p
            className={
              discountValid
                ? "rn-discount-success"
                : "rn-enroll-error"
            }
          >
            {discountMessage}
          </p>
        ) : null}
      </div>

      {pricing ? (
        <div className="rn-discount-summary">
          <div>
            <span>Original price</span>
            <strong>
              {formatNaira(
                pricing.originalAmount
              )}
            </strong>
          </div>

          <div>
            <span>Discount</span>
            <strong>
              -{formatNaira(
                pricing.discountAmount
              )}
            </strong>
          </div>

          <div>
            <span>Total</span>
            <strong>
              {formatNaira(
                pricing.finalAmount
              )}
            </strong>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={className}
        onClick={enroll}
        disabled={loading || validatingDiscount}
      >
        {loading
          ? "Processing..."
          : label}
      </button>

      {error ? (
        <p className="rn-enroll-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}