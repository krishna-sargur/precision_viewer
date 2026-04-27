import { NextResponse } from "next/server";
import fs from "fs";

const RAVE_DIR = "/vol/brains/bd1/restorelab/RAVE_Reconstructions";

export function GET() {
  try {
    const available = fs.existsSync(RAVE_DIR) && fs.statSync(RAVE_DIR).isDirectory();
    return NextResponse.json({ available });
  } catch {
    return NextResponse.json({ available: false });
  }
}
