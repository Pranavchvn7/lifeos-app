import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { LifeData } from "./model";
import { parseLifeData } from "./validate";

/** The log plus the version it is at. Version 0 means "nothing saved yet". */
export type LifeLogState = { data: LifeData | null; version: number };

export type SaveResult =
  | { ok: true; version: number }
  /** Another device saved first: here is what the server holds now, to merge with. */
  | { ok: false; conflict: true; data: LifeData | null; version: number };

function parseStored(payload: string | undefined): LifeData | null {
  if (!payload) return null;
  try {
    return parseLifeData(JSON.parse(payload) as unknown);
  } catch {
    return null;
  }
}

export const getLifeLog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LifeLogState> => {
    const { getSql } = await import("@/lib/db");
    const { readLifeLogRow } = await import("./life-log.server");
    const row = await readLifeLogRow(await getSql(), context.userId);
    return { data: parseStored(row?.payload), version: row?.version ?? 0 };
  });

export const saveLifeLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
    const baseVersion = body.baseVersion;
    if (typeof baseVersion !== "number" || !Number.isSafeInteger(baseVersion) || baseVersion < 0) {
      throw new Error("Invalid request");
    }
    return { data: parseLifeData(body.data), baseVersion };
  })
  .handler(async ({ context, data }): Promise<SaveResult> => {
    const { getSql } = await import("@/lib/db");
    const { writeLifeLogRow } = await import("./life-log.server");
    const result = await writeLifeLogRow(await getSql(), context.userId, JSON.stringify(data.data), data.baseVersion);
    if (result.ok) return { ok: true, version: result.version };
    return {
      ok: false,
      conflict: true,
      data: parseStored(result.current?.payload),
      version: result.current?.version ?? 0,
    };
  });
