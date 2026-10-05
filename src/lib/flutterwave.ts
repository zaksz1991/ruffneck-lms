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

function getSecretKey(): string {
  const secretKey =
    process.env.FLW_SECRET_KEY ??
    process.env.FLUTTERWAVE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "Flutterwave secret key is not configured."
    );
  }

  return secretKey;
}

function getApiHeaders() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type":
      "application/json",
  };
}

export function createTransactionReference(): string {
  const random =
    crypto
      .randomUUID()
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
): Promise<{
  link: string;
}> {
  const response =
    await fetch(
      "https://api.flutterwave.com/v3/payments",
      {
        method: "POST",
        headers:
          getApiHeaders(),
        body: JSON.stringify({
          amount:
            params.amount,

          currency:
            params.currency,

          tx_ref:
            params.txRef,

          redirect_url:
            params.redirectUrl,

          customer:
            params.customer,

          customizations: {
            title:
              "RuffNeck Learn",
            description:
              `Course enrollment: ${params.courseTitle}`,
          },

          meta: {
            source:
              "ruffneck-learn",
            course_id:
              params.courseId,
            student_id:
              params.studentId,
          },
        }),
        cache: "no-store",
      }
    );

  const data =
    (await response.json()) as FlutterwaveCreatePaymentResponse;

  if (
    !response.ok ||
    data.status !==
      "success" ||
    !data.data?.link
  ) {
    throw new Error(
      data.message ||
        "Flutterwave could not create the payment checkout."
    );
  }

  return {
    link:
      data.data.link,
  };
}

export async function verifyFlutterwaveTransaction(
  transactionId: string
): Promise<{
  id: number;
  txRef: string;
  amount: number;
  currency: string;
  status: string;
  flwRef: string | null;
}> {
  const cleanId =
    transactionId.trim();

  if (!/^\d+$/.test(cleanId)) {
    throw new Error(
      "Invalid Flutterwave transaction ID."
    );
  }

  const response =
    await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
        cleanId
      )}/verify`,
      {
        method: "GET",
        headers:
          getApiHeaders(),
        cache: "no-store",
      }
    );

  const data =
    (await response.json()) as FlutterwaveVerifyResponse;

  if (
    !response.ok ||
    data.status !==
      "success" ||
    !data.data
  ) {
    throw new Error(
      data.message ||
        "Flutterwave transaction verification failed."
    );
  }

  const id =
    Number(data.data.id);

  const amount =
    Number(data.data.amount);

  const currency =
    typeof data.data.currency ===
    "string"
      ? data.data.currency
      : "";

  const txRef =
    typeof data.data.tx_ref ===
    "string"
      ? data.data.tx_ref
      : "";

  const status =
    typeof data.data.status ===
    "string"
      ? data.data.status
      : "";

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(amount) ||
    !txRef
  ) {
    throw new Error(
      "Flutterwave returned an incomplete transaction."
    );
  }

  return {
    id,
    txRef,
    amount,
    currency,
    status,
    flwRef:
      typeof data.data.flw_ref ===
      "string"
        ? data.data.flw_ref
        : null,
  };
}

export async function verifyFlutterwaveByReference(
  txRef: string
) {
  const response =
    await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
        txRef
      )}`,
      {
        method: "GET",
        headers:
          getApiHeaders(),
        cache: "no-store",
      }
    );

  const data =
    (await response.json()) as FlutterwaveVerifyResponse;

  if (
    !response.ok ||
    data.status !==
      "success" ||
    !data.data
  ) {
    throw new Error(
      data.message ||
        "Flutterwave transaction verification failed."
    );
  }

  const id =
    Number(data.data.id);

  const amount =
    Number(data.data.amount);

  const currency =
    typeof data.data.currency ===
    "string"
      ? data.data.currency
      : "";

  const verifiedTxRef =
    typeof data.data.tx_ref ===
    "string"
      ? data.data.tx_ref
      : "";

  const status =
    typeof data.data.status ===
    "string"
      ? data.data.status
      : "";

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(amount) ||
    !verifiedTxRef
  ) {
    throw new Error(
      "Flutterwave returned an incomplete transaction."
    );
  }

  return {
    id,
    txRef: verifiedTxRef,
    amount,
    currency,
    status,
    flwRef:
      typeof data.data.flw_ref ===
      "string"
        ? data.data.flw_ref
        : null,
  };
}