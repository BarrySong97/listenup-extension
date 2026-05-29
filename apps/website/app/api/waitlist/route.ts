import { NextResponse, type NextRequest } from "next/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WaitlistRequest = {
  email?: unknown;
  source?: unknown;
};

class ConfigError extends Error {}

export async function POST(request: NextRequest) {
  let payload: WaitlistRequest;

  try {
    payload = (await request.json()) as WaitlistRequest;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const source =
    typeof payload.source === "string" && payload.source.trim()
      ? payload.source.trim()
      : "waitlist";

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    await triggerFeishuWaitlistFlow(email, source);

    return NextResponse.json({
      message: "You're on the list. We'll be in touch soon.",
    });
  } catch (error) {
    console.error("Waitlist submission failed", error);

    const message =
      error instanceof ConfigError
        ? "Waitlist integration is not configured yet."
        : "Something went wrong. Please try again.";

    return NextResponse.json({ message }, { status: 502 });
  }
}

async function triggerFeishuWaitlistFlow(email: string, source: string) {
  const webhookUrl = process.env.FEISHU_WAITLIST_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new ConfigError("Missing FEISHU_WAITLIST_WEBHOOK_URL.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "waitlist.joined",
      email,
      source,
      submittedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to trigger Feishu flow: ${response.status} ${body}`.trim(),
    );
  }
}
