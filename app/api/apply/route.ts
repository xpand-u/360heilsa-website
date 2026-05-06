import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const data = await req.json();

  const {
    name,
    email,
    phone,
    goals,
    level,
    injuries,
    schedule,
    referral,
  } = data;

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const html = `
    <h2>Ný umsókn um einkaþjálfun</h2>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;">
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;width:180px;">Nafn</td><td style="padding:8px;">${name}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;">Netfang</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;">Sími</td><td style="padding:8px;">${phone || "—"}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;">Markmið</td><td style="padding:8px;">${goals}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;">Þjálfunarstaða</td><td style="padding:8px;">${level}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;">Meiðsli / takmarkanir</td><td style="padding:8px;">${injuries || "Engar"}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;">Hentugar stundir</td><td style="padding:8px;">${schedule}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;">Hvernig fannst þér 360 Heilsa?</td><td style="padding:8px;">${referral || "—"}</td></tr>
    </table>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "umsokn@360heilsa.is",
      to: "rafn@360heilsa.is",
      reply_to: email,
      subject: `Umsókn um einkaþjálfun — ${name}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
