import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RAVE_DIR = "/vol/brains/bd1/restorelab/RAVE_Reconstructions";

export function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  // Reject empty names, path separators, or traversal attempts
  if (!name || /[/\\<>:"|?*]/.test(name) || name.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filePath = path.join(RAVE_DIR, name);
  try {
    if (!fs.existsSync(filePath)) return new NextResponse("Not found", { status: 404 });
    const content = fs.readFileSync(filePath);
    return new NextResponse(content, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new NextResponse("Error reading file", { status: 500 });
  }
}
