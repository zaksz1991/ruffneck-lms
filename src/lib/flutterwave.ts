import { randomUUID } from "node:crypto";

type FlutterwaveCreatePaymentResponse = {
  status?: string;
  message?: string;
  data?: {
    link?: string;
  };
};

type FlutterwaveVerifyResponse = {
  status?: string;
  message?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    amount?: number;
    charged_amount?: number;
    currency?: string;
    status?: string;
    flw_ref?: string;
  };
};

export type FlutterwaveVerifiedTransaction = {
  id: number;
  txRef: string;
  amount: number;
  chargedAmount: number | null;
  currency: string;
  status: string;
  flwRef: string | null;
};

const FLUTTERWAVE_API_BASE =
  "https://api.flutterwave.com/v3";

function getSecretKey(): string {
  const secretKey =
    process.env.FLW_SECRET_KEY ??
    process.env.FLUTTERWAVE_SECRET_KEY;

  if (!secretKey?.trim()) {
    throw new Error(
      "Flutterwave secret key is not configured."
    );
  }

  return secretKey.trim();
}

function getApiHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function readFlutterwaveResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Flutterwave returned an invalid response."
    );
  }

  if (
    !response.ok ||
    !data ||
    typeof data !== "object"
  ) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : fallbackMessage;

    throw new Error(
      `${fallbackMessage} ${message}`.trim()
    );
  }

  return data as T;
}

function isValidAmount(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100))
  );
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

export function createTransactionReference(): string {
  return `RNL-${Date.now()}-${randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)}`;
}

export async function createFlutterwavePayment(
  params: {
    amount: number;
    currency: string;
    txRef: string;
    redirectUrl: string;
    customer: {
      email: string;
      name?: string;
      phone_number?: string;
    };
    courseId: string;
    courseTitle: string;
    studentId: string;
  }
): Promise<{ link: string }> {
  if (
    !Number.isFinite(params.amount) ||
    params.amount <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  if (
    !Number.isSafeInteger(
      Math.round(params.amount * 100)
    )
  ) {
    throw new Error("Invalid payment amount.");
  }

  const currency = normalizeCurrency(params.currency);
  const txRef = params.txRef.trim();
  const redirectUrl = params.redirectUrl.trim();
  const email = params.customer.email.trim();

  if (
    !/^[A-Z]{3}$/.test(currency) ||
    !txRef ||
    !redirectUrl ||
    !email ||
    !params.courseId.trim() ||
    !params.studentId.trim()
  ) {
    throw new Error(
      "Required payment details are missing or invalid."
    );
  }

  let parsedRedirectUrl: URL;

  try {
    parsedRedirectUrl = new URL(redirectUrl);
  } catch {
    throw new Error(
      "The Flutterwave redirect URL is invalid."
    );
  }

  if (
    parsedRedirectUrl.protocol !== "https:" &&
    parsedRedirectUrl.hostname !== "localhost"
  ) {
    throw new Error(
      "The payment redirect URL must use HTTPS."
    );
  }

  const response = await fetch(
    `${FLUTTERWAVE_API_BASE}/payments`,
    {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({
        amount: params.amount,
        currency,
        tx_ref: txRef,
        redirect_url: redirectUrl,
        customer: {
          email,
          ...(params.customer.name?.trim()
            ? { name: params.customer.name.trim() }
            : {}),
          ...(params.customer.phone_number?.trim()
            ? {
                phone_number:
                  params.customer.phone_number.trim(),
              }
            : {}),
        },
        customizations: {
          title: "RuffNeck Learn",
          description: `Course enrollment: ${params.courseTitle}`,
        },
        meta: {
          source: "ruffneck-learn",
          course_id: params.courseId,
          student_id: params.studentId,
        },
      }),
      cache: "no-store",
    }
  );

  const data =
    await readFlutterwaveResponse<FlutterwaveCreatePaymentResponse>(
      response,
      "Flutterwave could not create the payment checkout."
    );

  if (
    data.status !== "success" ||
    typeof data.data?.link !== "string" ||
    !data.data.link.trim()
  ) {
    throw new Error(
      data.message ||
        "Flutterwave did not return a checkout link."
    );
  }

  let checkoutUrl: URL;

  try {
    checkoutUrl = new URL(data.data.link);
  } catch {
    throw new Error(
      "Flutterwave returned an invalid checkout URL."
    );
  }

  if (
    checkoutUrl.protocol !== "https:" ||
    checkoutUrl.hostname !== "checkout.flutterwave.com"
  ) {
    throw new Error(
      "Flutterwave returned an unexpected checkout URL."
    );
  }

  return {
    link: checkoutUrl.toString(),
  };
}

function parseVerifiedTransaction(
  data: FlutterwaveVerifyResponse
): FlutterwaveVerifiedTransaction {
  if (
    data.status !== "success" ||
    !data.data ||
    typeof data.data !== "object"
  ) {
    throw new Error(
      data.message ||
        "Flutterwave transaction verification failed."
    );
  }

  const transaction = data.data;

  const id = Number(transaction.id);
  const amount = Number(transaction.amount);

  const chargedAmount =
    transaction.charged_amount == null
      ? null
      : Number(transaction.charged_amount);

  const txRef =
    typeof transaction.tx_ref === "string"
      ? transaction.tx_ref.trim()
      : "";

  const currency =
    typeof transaction.currency === "string"
      ? normalizeCurrency(transaction.currency)
      : "";

  const status =
    typeof transaction.status === "string"
      ? transaction.status.trim().toLowerCase()
      : "";

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !isValidAmount(amount) ||
    (chargedAmount !== null &&
      !isValidAmount(chargedAmount)) ||
    !txRef ||
    !/^[A-Z]{3}$/.test(currency) ||
    !status
  ) {
    throw new Error(
      "Flutterwave returned an incomplete or invalid transaction."
    );
  }

  return {
    id,
    txRef,
    amount,
    chargedAmount,
    currency,
    status,
    flwRef:
      typeof transaction.flw_ref === "string" &&
      transaction.flw_ref.trim()
        ? transaction.flw_ref.trim()
        : null,
  };
}

export async function verifyFlutterwaveTransaction(
  transactionId: string
): Promise<FlutterwaveVerifiedTransaction> {
  const cleanId = transactionId.trim();

  if (!/^\d+$/.test(cleanId)) {
    throw new Error(
      "Invalid Flutterwave transaction ID."
    );
  }

  const numericId = Number(cleanId);

  if (
    !Number.isSafeInteger(numericId) ||
    numericId <= 0
  ) {
    throw new Error(
      "Invalid Flutterwave transaction ID."
    );
  }

  const response = await fetch(
    `${FLUTTERWAVE_API_BASE}/transactions/${encodeURIComponent(
      cleanId
    )}/verify`,
    {
      method: "GET",
      headers: getApiHeaders(),
      cache: "no-store",
    }
  );

  const data =
    await readFlutterwaveResponse<FlutterwaveVerifyResponse>(
      response,
      "Flutterwave transaction verification failed."
    );

  const verified = parseVerifiedTransaction(data);

  if (verified.id !== numericId) {
    throw new Error(
      "Flutterwave returned a different transaction ID."
    );
  }

  return verified;
}

export async function verifyFlutterwaveByReference(
  txRef: string
): Promise<FlutterwaveVerifiedTransaction> {
  const cleanTxRef = txRef.trim();

  if (!cleanTxRef) {
    throw new Error(
      "Transaction reference is required."
    );
  }

  const response = await fetch(
    `${FLUTTERWAVE_API_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
      cleanTxRef
    )}`,
    {
      method: "GET",
      headers: getApiHeaders(),
      cache: "no-store",
    }
  );

  const data =
    await readFlutterwaveResponse<FlutterwaveVerifyResponse>(
      response,
      "Flutterwave transaction verification failed."
    );

  const verified = parseVerifiedTransaction(data);

  if (verified.txRef !== cleanTxRef) {
    throw new Error(
      "Flutterwave transaction reference does not match."
    );
  }

  return verified;
}