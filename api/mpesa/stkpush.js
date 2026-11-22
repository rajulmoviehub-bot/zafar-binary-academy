const { randomUUID } = require("crypto");

const json = (res, status, body) => res.status(status).setHeader("Content-Type","application/json").json(body);
const env = (name) => (process.env[name] || "").trim();

async function supabaseRequest(path, options = {}) {
  const base = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) throw new Error("Supabase server configuration is incomplete.");
  const response = await fetch(base.replace(/\/$/, "") + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error_description || "Database request failed.");
  return body;
}

async function darajaToken() {
  const key = env("MPESA_CONSUMER_KEY");
  const secret = env("MPESA_CONSUMER_SECRET");
  if (!key || !secret) throw new Error("M-Pesa API credentials are missing in Vercel.");
  const host = env("MPESA_ENVIRONMENT").toLowerCase() === "sandbox"
    ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";
  const auth = Buffer.from(key + ":" + secret).toString("base64");
  const response = await fetch(host + "/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: "Basic " + auth }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Could not authenticate with M-Pesa.");
  return { token: data.access_token, host };
}

function normalizePhone(value) {
  let phone = String(value || "").replace(/[\s()+-]/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;
  if (!/^254[17]\d{8}$/.test(phone)) throw new Error("Enter a valid Kenyan Safaricom number, e.g. 0712345678 or +254712345678.");
  return phone;
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
    const applications = await supabaseRequest("/rest/v1/student_applications?user_id=eq." + encodeURIComponent(user.id) + "&select=id,payment_status,application_status");
    const application = applications[0];
    if (!application) return json(res, 400, { error: "Your student application was not found. Please complete registration and sign in again." });
    if (application.payment_status === "paid") return json(res, 409, { error: "Your course payment is already recorded." });

    const paid = await supabaseRequest("/rest/v1/student_applications?payment_status=eq.paid&select=id");
    const usdAmount = paid.length < 20 ? 25 : 50;
    const rateResponse = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const rateData = await rateResponse.json().catch(() => ({}));
    const rate = Number(rateData && rateData.rates && rateData.rates.KES);
    if (!rateResponse.ok || !Number.isFinite(rate) || rate <= 0) throw new Error("Live USD/KES exchange rate is unavailable. Please try again later.");
    const amount = Math.max(1, Math.round(usdAmount * rate));

    const shortcode = env("MPESA_SHORTCODE");
    const passkey = env("MPESA_PASSKEY");
    const callbackUrl = env("MPESA_CALLBACK_URL") || "https://zafar-binary-academy.vercel.app/api/mpesa/callback";
    if (!shortcode || !passkey) throw new Error("M-Pesa Till number or passkey is missing in Vercel.");
    if (!callbackUrl.startsWith("https://")) throw new Error("M-Pesa callback URL must use HTTPS.");

    const id = randomUUID();
    await supabaseRequest("/rest/v1/academy_payment_intents", {
      method: "POST",
      body: JSON.stringify({
        id, user_id: user.id, application_id: application.id, amount_kes: amount,
        usd_amount: usdAmount, exchange_rate: rate, phone, status: "initiating"
      })
    });

    const { token, host } = await darajaToken();
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth()+1).padStart(2,"0") + String(now.getDate()).padStart(2,"0") +
      String(now.getHours()).padStart(2,"0") + String(now.getMinutes()).padStart(2,"0") +
      String(now.getSeconds()).padStart(2,"0");
    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");
    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: "ZAFAR-" + id.slice(0,8).toUpperCase(),
      TransactionDesc: "ZAFAR COURSE"
    };
    const response = await fetch(host + "/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ResponseCode !== "0" || !result.CheckoutRequestID) {
      await supabaseRequest("/rest/v1/academy_payment_intents?id=eq." + id, {
        method: "PATCH", body: JSON.stringify({ status: "failed", result_description: result.errorMessage || result.ResponseDescription || "STK request failed." })
      }).catch(() => {});
      return json(res, 502, { error: result.errorMessage || result.ResponseDescription || "M-Pesa could not start the payment prompt." });
    }
    await supabaseRequest("/rest/v1/academy_payment_intents?id=eq." + id, {
      method: "PATCH", body: JSON.stringify({
        status: "stk_sent", checkout_request_id: result.CheckoutRequestID,
        merchant_request_id: result.MerchantRequestID || null
      })
    });
    return json(res, 200, {
      ok: true, payment_id: id, amount_kes: amount, usd_amount: usdAmount,
      checkout_request_id: result.CheckoutRequestID,
      message: "Check your phone and enter your M-Pesa PIN. Payment remains pending until the academy verifies the Safaricom receipt."
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Could not start M-Pesa payment." });
  }
};
