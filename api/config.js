// Vercel serverless function — safely exposes public Razorpay Key ID from env vars
// RAZORPAY_KEY_SECRET stays server-side only and is NEVER sent to the client
module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json({
    razorpay_key_id: process.env.RAZORPAY_KEY_ID || ""
  });
};
