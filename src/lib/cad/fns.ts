import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { CadDrawing, CadDrawingKind, CadDrawingMeta, CadPin } from "./types";

export const listCadDrawingsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CadDrawingMeta[]> => {
    const { listCadDrawings } = await import("./cad.server");
    return listCadDrawings(context.userId);
  });

export const getCadDrawingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }): Promise<CadDrawing | null> => {
    const { getCadDrawing } = await import("./cad.server");
    return getCadDrawing(context.userId, id);
  });

export const saveCadDrawingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id?: string;
      name: string;
      kind: CadDrawingKind;
      heThong: "He_600" | "He_220" | "CHUNG";
      fileName: string;
      driveUrl: string;
      dxfText: string;
      pins: CadPin[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { saveCadDrawing } = await import("./cad.server");
    return saveCadDrawing(context.userId, data);
  });

export const saveCadPinsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; pins: CadPin[] }) => input)
  .handler(async ({ context, data }) => {
    const { saveCadPins } = await import("./cad.server");
    return saveCadPins(context.userId, data.id, data.pins);
  });

export const deleteCadDrawingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { deleteCadDrawing } = await import("./cad.server");
    await deleteCadDrawing(context.userId, id);
    return { ok: true as const };
  });
