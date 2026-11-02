import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const CACHE = { "cache-control": "public, max-age=60, stale-while-revalidate=600" };

export default async function Icon() {
  const iconPath = path.join(process.cwd(), "public/brand/robusty-favicon.png");
  if (fs.existsSync(iconPath)) {
    const fileBuffer = fs.readFileSync(iconPath);
    return new Response(fileBuffer, {
      headers: {
        "content-type": "image/png",
        ...CACHE,
      },
    });
  }

  return new Response(null, { status: 404 });
}
