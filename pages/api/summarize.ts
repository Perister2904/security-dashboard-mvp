import type { NextApiRequest, NextApiResponse } from "next";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const org = (req.query.org as string) || "Acme Bank";
  const summary = `Organization: ${org}

• Risk is stable; no critical intrusions in the last 24 hours.
• ${org} systems updated: 82% (12 devices overdue >7 days).
• Phishing campaign blocked (7 accounts targeted) — no impact.
• Web perimeter: 2 medium findings (TLS config, outdated library). Fix ETA: 48h.
• Response speed improved 11% week-over-week; auto-triage reduced analyst load 18%.

Decisions for leaders:
1) Approve a 48-hour patch window for internet-facing systems.
2) Run a phishing simulation + short training next week.
3) Ask owners to attach evidence for overdue controls.`;
  res.status(200).json({ summary });
}
