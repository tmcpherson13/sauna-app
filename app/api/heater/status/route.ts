import { NextResponse } from "next/server";
import { getDeviceStatus } from "@/lib/tuya";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const deviceId = process.env.TUYA_HEATER_DEVICE_ID!;
    const status = await getDeviceStatus(deviceId);
    return NextResponse.json({
      on: Boolean(status.switch_led),
      timerMinutes: Number(status.countdown_1 ?? 0),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
