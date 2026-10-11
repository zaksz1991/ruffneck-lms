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

function getApiHeaders() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
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

    throw new Error(message);
  }

  return data as T;
}

export function createTransactionReference(): string {
  const random = randomUUID()
    .replace(/-/g, "")
    .slice(0, 12);

  return `RNL-${Date.now()}-${random}`;
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
    !params.currency.trim() ||
    !params.txRef.trim() ||
    !params.redirectUrl.trim() ||
    !params.customer.email.trim()
  ) {
    throw new Error(
      "Required payment details are missing."
    );
  }

  const response = await fetch(
    "https://api.flutterwave.com/v3/payments",
    {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        tx_ref: params.txRef,
        redirect_url: params.redirectUrl,
        customer: params.customer,
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

  return {
    link: data.data.link,
  };
}

function parseVerifiedTransaction(
  data: FlutterwaveVerifyResponse
): FlutterwaveVerifiedTransaction {
  if (
    data.status !== "success" ||
    !data.data
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
      ? transaction.tx_ref
      : "";

  const currency =
    typeof transaction.currency === "string"
      ? transaction.currency
      : "";

  const status =
    typeof transaction.status === "string"
      ? transaction.status
      : "";

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    (chargedAmount !== null &&
      (!Number.isFinite(chargedAmount) ||
        chargedAmount < 0)) ||
    !txRef ||
    !currency ||
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
      typeof transaction.flw_ref === "string"
        ? transaction.flw_ref
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

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
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

  if (String(verified.id) !== cleanId) {
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
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
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