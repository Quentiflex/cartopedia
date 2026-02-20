import { NextResponse } from "next/server";
import { readdir, readFile, access } from "fs/promises";
import path from "path";

const DATA_FILES = "data_files";

export type DatasetEntry = { id: string; label: string };

/** List OWID-style datasets: each folder under data_files with <name>.csv and optional metadata for title */
export async function GET() {
  const base = path.join(process.cwd(), DATA_FILES);
  let dirs: string[];
  try {
    dirs = await readdir(base, { withFileTypes: true })
      .then((entries) => entries.filter((e) => e.isDirectory()).map((e) => e.name));
  } catch {
    return NextResponse.json({ datasets: [] }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  }

  const datasets: DatasetEntry[] = [];
  for (const dir of dirs) {
    const csvPath = path.join(base, dir, `${dir}.csv`);
    const metaPath = path.join(base, dir, `${dir}.metadata.json`);
    try {
      await access(csvPath);
    } catch {
      continue; // no CSV
    }
    let label = dir.replace(/-/g, " ");
    try {
      const raw = await readFile(metaPath, "utf-8");
      const meta = JSON.parse(raw) as { chart?: { title?: string } };
      if (meta.chart?.title) label = meta.chart.title;
    } catch {
      // keep label from dir name
    }
    datasets.push({ id: dir, label });
  }

  datasets.sort((a, b) => a.label.localeCompare(b.label));

  return NextResponse.json(
    { datasets },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
