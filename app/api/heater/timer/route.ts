import { NextRequest, NextResponse } from "next/server";
import { sendCommand } from "@/lib/tuya";

export async function POST(req: NextRequest) {
  try {
    const { minutes } = await req.json();
    const deviceId = process.env.TUYA_HEATER_DEVICE_ID!;
    const clamped = Math.max(0, Math.min(60, Number(minutes)));
    await sendCommand(deviceId, [{ code: "countdown_1", value: clamped }]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
