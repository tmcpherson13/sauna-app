import { NextRequest, NextResponse } from "next/server";
import { sendCommand } from "@/lib/tuya";

export async function POST(req: NextRequest) {
  try {
    const { on } = await req.json();
    const deviceId = process.env.TUYA_HEATER_DEVICE_ID!;
    await sendCommand(deviceId, [{ code: "switch_led", value: Boolean(on) }]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
