const env = (name) => (process.env[name] || "").trim();
const json = (res, status, body) => res.status(status).setHeader("Content-Type","application/json").json(body);

async function db(path, options = {}) {
  const base = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) throw new Error("Database server configuration is missing.");
  const response = await fetch(base.replace(/\/$/, "") + path, {
    ...options,
    headers: {
      apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json",
      Prefer: "return=representation", ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Database update failed.");
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ResultCode: 1, ResultDesc: "Method not allowed" });
  try {
    const callback = req.body && req.body.Body && req.body.Body.stkCallback;
    if (!callback || !callback.CheckoutRequestID) return json(res, 400, { ResultCode: 1, ResultDesc: "Invalid callback" });
    const checkoutId = String(callback.CheckoutRequestID);
    const rows = await db("/rest/v1/academy_payment_intents?checkout_request_id=eq." + encodeURIComponent(checkoutId) + "&select=id,user_id,application_id,amount_kes,phone,status");
    const intent = rows[0];
    if (!intent) return json(res, 200, { ResultCode: 0, ResultDesc: "Callback received" });

    const resultCode = Number(callback.ResultCode);
    const items = callback.CallbackMetadata && Array.isArray(callback.CallbackMetadata.Item)
      ? callback.CallbackMetadata.Item : [];
    const value = (name) => {
      const item = items.find(entry => entry.Name === name);
      return item ? item.Value : null;
    };
    const amount = Number(value("Amount"));
    const receipt = value("MpesaReceiptNumber");
    const phone = value("PhoneNumber") == null ? "" : String(value("PhoneNumber"));
    if (resultCode === 0) {
      const expectedPhone = String(intent.phone).replace(/\D/g,"");
      if (!receipt || !Number.isFinite(amount) || amount !== Number(intent.amount_kes) || phone !== expectedPhone) {
        await db("/rest/v1/academy_payment_intents?id=eq." + intent.id, {
          method: "PATCH", body: JSON.stringify({ status: "review_required", raw_callback: req.body, result_description: "Callback details did not match the saved payment request." })
        });
        return json(res, 200, { ResultCode: 0, ResultDesc: "Callback received for review" });
      }
      await db("/rest/v1/academy_payment_intents?id=eq." + intent.id, {
        method: "PATCH", body: JSON.stringify({
          status: "callback_received", mpesa_receipt: String(receipt),
          callback_amount: amount, callback_phone: phone, raw_callback: req.body,
          result_code: resultCode, result_description: String(callback.ResultDesc || "Payment callback received.")
        })
      });
      // Do not mark a student paid from an unauthenticated browser or callback.
      // Admin must verify the receipt in the actual M-Pesa statement first.
      await db("/rest/v1/student_applications?id=eq." + intent.application_id, {
        method: "PATCH", body: JSON.stringify({ payment_reference: String(receipt) })
      });
    } else {
      await db("/rest/v1/academy_payment_intents?id=eq." + intent.id, {
        method: "PATCH", body: JSON.stringify({
          status: "failed", result_code: resultCode,
          result_description: String(callback.ResultDesc || "M-Pesa payment was not completed."),
          raw_callback: req.body
        })
      });
    }
    return json(res, 200, { ResultCode: 0, ResultDesc: "Callback processed" });
  } catch (_) {
    // Safaricom retries failed callbacks; never disclose internal credentials or errors.
    return json(res, 500, { ResultCode: 1, ResultDesc: "Callback processing failed" });
  }
};
