const { randomUUID } = require("crypto");

const env = (name) => (process.env[name] || "").trim();
const json = (res, status, body) => res.status(status).setHeader("Content-Type", "application/json").json(body);

async function db(path, options = {}) {
  const base = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) throw new Error("Database server configuration is incomplete.");
  const response = await fetch(base.replace(/\/$/, "") + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error_description || "Database request failed.");
  return data;
}

function normalizePhone(value) {
  let phone = String(value || "").replace(/[\s()+-]/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;
  if (!/^254[17]\d{8}$/.test(phone)) throw new Error("Enter a valid Kenyan Safaricom number, e.g. 0712345678 or +254712345678.");
  return phone;
}

async function tumaToken() {
  const email = env("TUMA_BUSINESS_EMAIL");
  const apiKey = env("TUMA_API_KEY");
  if (!email || !apiKey) throw new Error("Tuma API credentials are missing in Vercel.");
  const response = await fetch("https://api.tuma.co.ke/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, api_key: apiKey })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true || !data.token) {
    throw new Error(data.message || "Tuma authentication failed. Check the saved credentials and account mode.");
  }
  return data.token;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!accessToken) return json(res, 401, { error: "Please log in before paying." });

    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !anonKey) return json(res, 503, { error: "Supabase public configuration is missing." });
    const userResponse = await fetch(supabaseUrl.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + accessToken }
    });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !user.id || !user.email_confirmed_at) return json(res, 401, { error: "Please confirm your email and sign in again." });

    const phone = normalizePhone(req.body && req.body.phone);
    const applications = await db("/rest/v1/student_applications?user_id=eq." + encodeURIComponent(user.id) + "&select=id,payment_status,country");
    const application = applications[0];
    if (!application) return json(res, 400, { error: "Your student application was not found. Please complete registration and sign in again." });
    if (application.country !== "Kenya") return json(res, 403, { error: "Tuma M-Pesa checkout is currently enabled only for students registered in Kenya." });
    if (application.payment_status === "paid") return json(res, 409, { error: "Your course payment is already recorded." });

    const paid = await db("/rest/v1/student_applications?payment_status=eq.paid&select=id");
    const foundingOffer = paid.length < 20;
    const amount = foundingOffer ? 10000 : 15000;
    const usdKesRate = Number(env("USD_KES_REFERENCE_RATE")) || 129.97;
    const amountUsd = Number((amount / usdKesRate).toFixed(2));
    const callbackUrl = env("TUMA_CALLBACK_URL") || "https://zafar-binary-academy.vercel.app/api/tuma/callback";
    if (!callbackUrl.startsWith("https://")) throw new Error("Tuma callback URL must use HTTPS.");

    const id = randomUUID();
    await db("/rest/v1/academy_payment_intents", {
      method: "POST",
      body: JSON.stringify({
        id, user_id: user.id, application_id: application.id, amount_kes: amount,
        fee_amount_kes: amount, phone, status: "initiating"
      })
    });

    const token = await tumaToken();
    const response = await fetch("https://api.tuma.co.ke/payment/stk-push", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        phone,
        callback_url: callbackUrl,
        description: "ZAFAR BINARY ACADEMY COURSE FEE"
      })
    });
    const result = await response.json().catch(() => ({}));
    const data = result.data || {};
    const checkoutId = data.checkout_request_id || data.checkoutRequestID || data.CheckoutRequestID;
    const merchantId = data.merchant_request_id || data.MerchantRequestID || null;
    if (!response.ok || result.success !== true || !checkoutId) {
      await db("/rest/v1/academy_payment_intents?id=eq." + id, {
        method: "PATCH",
        body: JSON.stringify({ status: "failed", result_description: String(result.message || "Tuma could not start the STK request.").slice(0, 500) })
      }).catch(() => {});
      return json(res, 502, { error: result.message || "Tuma could not start the M-Pesa payment prompt." });
    }

    await db("/rest/v1/academy_payment_intents?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({
        status: "stk_sent",
        checkout_request_id: String(checkoutId),
        merchant_request_id: merchantId ? String(merchantId) : null
      })
    });
    return json(res, 200, {
      ok: true,
      payment_id: id,
      amount_usd: amountUsd,
      founding_offer: foundingOffer,
      checkout_request_id: String(checkoutId),
      message: "Tuma sent the M-Pesa prompt. Enter your PIN if you initiated this payment. Enrolment remains pending until the academy independently verifies the receipt."
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Could not start Tuma payment." });
  }
};
