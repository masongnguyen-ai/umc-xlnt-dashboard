import { createFileRoute } from "@tanstack/react-router";
import { FLOW_SHEET_URL } from "@/lib/flow-data";
import { parseFlowCsv } from "@/lib/flow";

export const Route = createFileRoute("/api/luu-luong")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const res = await fetch(FLOW_SHEET_URL, {
            headers: { "User-Agent": "UMC-XLNT/1.0" },
            cache: "no-store",
          });
          if (!res.ok) {
            return Response.json({ ok: false, error: `Sheet HTTP ${res.status}` }, { status: 502 });
          }
          const csv = await res.text();
          const days = parseFlowCsv(csv);
          if (!days.length) {
            return Response.json({ ok: false, error: "Sheet không có dòng lưu lượng 24h." }, { status: 502 });
          }
          return Response.json({
            ok: true,
            from: days[0].iso,
            to: days[days.length - 1].iso,
            rows: days.length,
            days,
          });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Không đọc được sheet" },
            { status: 502 },
          );
        }
      },
    },
  },
});
