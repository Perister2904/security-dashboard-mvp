import type { NextApiRequest, NextApiResponse } from "next";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const findings = [
    { control: "Patching SLA (7d)", status: "Fail", owner: "IT Ops", evidence: "12 endpoints >7d", due: "48h" },
    { control: "Alert Triage < 30m", status: "Pass", owner: "SOC", evidence: "P95=22m", due: "-" },
    { control: "IR Playbook Updated", status: "Warn", owner: "IR Lead", evidence: "Last update 90d", due: "1 week" },
    { control: "MFA Coverage", status: "Pass", owner: "IAM", evidence: "99.2% active users", due: "-" },
  ];
  res.status(200).json({ findings });
}
