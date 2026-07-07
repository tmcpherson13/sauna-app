import { NextRequest, NextResponse } from "next/server";
import { sendCommand } from "@/lib/tuya";

export async function POST(req: NextRequest) {
  try {
    const { on, targetTempF } = await req.json();
    const deviceId = process.env.TUYA_HEATER_DEVICE_ID!;
    const commands: { code: string; value: unknown }[] = [
      { code: "switch_led", value: Boolean(on) },
    ];
    if (on && targetTempF) {
      const clamped = Math.max(32, Math.min(194, Number(targetTempF)));
      commands.push({ code: "work_mode", value: "temp" });
      commands.push({ code: "temp_set_f", value: clamped });
    }
    await sendCommand(deviceId, commands);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}