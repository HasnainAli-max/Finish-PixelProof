// pages/api/_supabase-env-check.js
export default function handler(req, res) {
  res.json({
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
