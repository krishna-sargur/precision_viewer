import { NextResponse } from "next/server";
import fs from "fs";

const JSON_PATH = "/bdz/restorelab/Precision_Data/precision_list.json";

export function GET() {
  try {
    if (!fs.existsSync(JSON_PATH)) {
      return NextResponse.json({ available: false, recordings: {} });
    }
    const json = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    const recordings: Record<string, string[]> = {};
    for (const ptField of Object.keys(json)) {
      const ptNum = String(ptField).replace(/[^0-9]/g, "");
      if (!ptNum) continue;
      const recs = json[ptField]?.recordings;
      if (!recs || typeof recs !== "object") continue;
      recordings[ptNum] = Object.values(recs).filter((v): v is string => typeof v === "string");
    }
    return NextResponse.json({ available: true, recordings });
  } catch {
    return NextResponse.json({ available: false, recordings: {} });
  }
}
