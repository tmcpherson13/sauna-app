import { NextRequest, NextResponse } from "next/server";
import { sendCommand } from "@/lib/tuya";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { targetTempF } = await req.json();
    const deviceId = process.env.TUYA_HEATER_DEVICE_ID!;
    const clamped = Math.max(32, Math.min(194, Number(targetTempF)));

    await sendCommand(deviceId, [{ code: "work_mode", value: "temp" }]);
    await sleep(1500);
    await sendCommand(deviceId, [{ code: "temp_set_f", value: clamped }]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
