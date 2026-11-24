const env = (name) => (process.env[name] || "").trim();
const json = (res, status, body) => res.status(status).setHeader("Content-Type", "application/json").json(body);

async function db(path, options = {}) {
  const base = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) throw new Error("Database server configuration is missing.");
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
  if (!response.ok) throw new Error(data.message || "Database update failed.");
  return data;
}

// Tuma's supplied documentation shows callback fields but does not document
// a signature-verification mechanism. Therefore this endpoint records callbacks
// for reconciliation only and NEVER grants course access or marks a student paid.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { success: false, message: "Method not allowed." });
  try {
    const body = req.body || {};
    const checkoutId = String(body.checkout_request_id || body.checkoutRequestID || body.CheckoutRequestID || "");
    if (!checkoutId || checkoutId.length > 200) return json(res, 400, { success: false, message: "Missing checkout request ID." });

    const rows = await db("/rest/v1/academy_payment_intents?checkout_request_id=eq." + encodeURIComponent(checkoutId) + "&select=id,application_id,amount_kes,phone,status");
    const intent = rows[0];
    if (!intent) return json(res, 200, { success: true, message: "Callback acknowledged; no matching pending payment was found." });

    const sandboxTest = String(intent.status || "").startsWith("sandbox_");
    const resultCode = Number(body.result_code ?? body.resultCode ?? body.ResultCode);
    const status = String(body.status || "").toLowerCase();
    const amount = Number(body.amount);
    const receipt = body.mpesa_receipt_number || body.mpesa_receipt || body.MpesaReceiptNumber || null;
    const callbackPhone = String(body.phone || body.customer_phone || body.PhoneNumber || "").replace(/\D/g, "");
    const expectedPhone = String(intent.phone || "").replace(/\D/g, "");
    const success = resultCode === 0 && (status === "completed" || status === "success") &&
      !!receipt && Number.isFinite(amount) && amount === Number(intent.amount_kes) &&
      (!callbackPhone || callbackPhone === expectedPhone);

    const patch = success
      ? { status: sandboxTest ? "sandbox_callback_received" : "callback_received", mpesa_receipt: String(receipt), callback_amount: amount, callback_phone: callbackPhone || null, result_code: resultCode, result_description: "Tuma callback received; awaiting independent merchant reconciliation.", raw_callback: body }
      : { status: (status === "failed" || (Number.isFinite(resultCode) && resultCode !== 0)) ? "failed" : "review_required", result_code: Number.isFinite(resultCode) ? resultCode : null, result_description: "Tuma callback received; details require independent verification.", raw_callback: body };

    await db("/rest/v1/academy_payment_intents?id=eq." + intent.id, { method: "PATCH", body: JSON.stringify(patch) });
    if (success && receipt && !sandboxTest) {
      await db("/rest/v1/student_applications?id=eq." + intent.application_id, {
        method: "PATCH", body: JSON.stringify({ payment_reference: String(receipt) })
      });
    }
    return json(res, 200, { success: true, message: "Callback recorded for reconciliation." });
  } catch (_) {
    return json(res, 500, { success: false, message: "Callback processing failed." });
  }
};
