import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Download,
  FolderOpen,
  HelpCircle,
  Link2,
  MapPin,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { CadViewer, useHiddenLayers } from "@/components/cad-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DxfError, detectCadFile, parseDxf, writeDxf } from "@/lib/cad/dxf";
import { deleteCadDrawingFn, getCadDrawingFn, listCadDrawingsFn, saveCadDrawingFn, saveCadPinsFn } from "@/lib/cad/fns";
import { mergePins, pinsFromDxf } from "@/lib/cad/pins";
import { PLANT_DXF_NAME, buildPlantPid, plantDxfText, plantPins } from "@/lib/cad/plant-pid";
import type { CadDrawingMeta, CadPin, DxfDoc } from "@/lib/cad/types";
import { MAX_DXF_CHARS } from "@/lib/cad/types";
import { can } from "@/lib/permissions";
import { useAppStore } from "@/lib/store";
import type { EqStatus, Equipment, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { errMessage } from "@/lib/ops/client";

const EQ_TT: Record<EqStatus, string> = {
  HOAT_DONG: "Hoạt động",
  BAO_TRI: "Bảo trì",
  HONG: "Hỏng",
  NGUNG: "Ngừng",
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusVariant(st: EqStatus): "ok" | "warn" | "bad" | "default" {
  if (st === "HOAT_DONG") return "ok";
  if (st === "BAO_TRI") return "warn";
  if (st === "HONG" || st === "NGUNG") return "bad";
  return "default";
}

export function CadDesk({ role, focusId }: { role: Role; focusId?: string }) {
  const writable = can(role, "write_bave");
  const equipments = useAppStore((s) => s.equipments);
  const byId = useMemo(() => {
    const m = new Map<string, Equipment>();
    for (const e of equipments) m.set(e.Equipment_ID, e);
    return m;
  }, [equipments]);

  const plantDoc = useMemo(() => buildPlantPid(), []);
  const [doc, setDoc] = useState<DxfDoc>(plantDoc);
  const [dxfText, setDxfText] = useState("");
  const [sourceName, setSourceName] = useState("Sơ đồ công nghệ UMC");
  const [fileName, setFileName] = useState(PLANT_DXF_NAME);
  const [kind, setKind] = useState<"PLANT" | "DXF" | "LINK">("PLANT");
  const [pins, setPins] = useState<CadPin[]>(() => plantPins());
  const [selectedId, setSelectedId] = useState<string | undefined>(focusId);
  const [pinTarget, setPinTarget] = useState<string>("");
  const [pinMode, setPinMode] = useState(false);
  const [help, setHelp] = useState(false);
  const [library, setLibrary] = useState<CadDrawingMeta[]>([]);
  const [activeId, setActiveId] = useState<string | "plant">("plant");
  const [driveUrl, setDriveUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [heThong, setHeThong] = useState<"CHUNG" | "He_600" | "He_220">("CHUNG");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const layers = useHiddenLayers(doc);

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  useEffect(() => {
    void listCadDrawingsFn()
      .then(setLibrary)
      .catch(() => setLibrary([]));
  }, []);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const missing = pins.filter((p) => !byId.has(p.equipmentId)).length;

  function loadPlant() {
    setDoc(plantDoc);
    setDxfText("");
    setSourceName("Sơ đồ công nghệ UMC");
    setFileName(PLANT_DXF_NAME);
    setKind("PLANT");
    setPins(plantPins());
    setActiveId("plant");
    setPinMode(false);
    layers.setHidden(new Set());
  }

  async function onPickFile(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".dwg")) {
      toast.error("DWG chưa đọc được trong trình duyệt. Trong AutoCAD: Save As → DXF ASCII, hoặc dán link Drive bên dưới.");
      return;
    }
    const buf = await file.arrayBuffer();
    const head = String.fromCharCode(...new Uint8Array(buf).slice(0, 6));
    if (head.startsWith("AC10")) {
      toast.error("Đây là DWG nhị phân. Lưu lại thành DXF ASCII trong AutoCAD rồi nhập.");
      return;
    }
    const text = new TextDecoder("utf-8").decode(buf);
    const kindFile = detectCadFile(text);
    if (kindFile === "DWG") {
      toast.error("File DWG. Hãy Save As → AutoCAD DXF (ASCII).");
      return;
    }
    try {
      const parsed = parseDxf(text);
      const auto = pinsFromDxf(parsed, new Set(equipments.map((e) => e.Equipment_ID)));
      setDoc(parsed);
      setDxfText(text.length > MAX_DXF_CHARS ? text.slice(0, MAX_DXF_CHARS) : text);
      setSourceName(file.name.replace(/\.[^.]+$/, ""));
      setFileName(file.name);
      setKind("DXF");
      setPins(auto);
      setActiveId("local");
      setPinMode(auto.length === 0);
      toast.success(
        auto.length
          ? `Đã đọc ${parsed.entities.length} đối tượng · ${auto.length} mã thiết bị trên bản vẽ.`
          : `Đã đọc ${parsed.entities.length} đối tượng. Gắn mã TB-xxx bằng cách chọn thiết bị rồi chạm lên bản vẽ.`,
      );
    } catch (err) {
      toast.error(err instanceof DxfError ? err.message : errMessage(err, "Không đọc được DXF."));
    }
  }

  function exportCurrent() {
    const text = kind === "DXF" && dxfText ? dxfText : writeDxf(doc);
    downloadText(fileName.endsWith(".dxf") ? fileName : `${fileName}.dxf`, text);
    toast.success("Đã tải DXF — mở bằng AutoCAD (OPEN) hoặc kéo thả vào cửa sổ bản vẽ.");
  }

  async function saveCurrent() {
    if (!writable) return;
    setSaving(true);
    try {
      const meta = await saveCadDrawingFn({
        data: {
          id: activeId !== "plant" && activeId !== "local" ? activeId : undefined,
          name: sourceName,
          kind: kind === "LINK" ? "LINK" : kind === "PLANT" ? "PLANT" : "DXF",
          heThong,
          fileName,
          driveUrl,
          dxfText: kind === "DXF" ? dxfText || writeDxf(doc) : kind === "PLANT" ? plantDxfText() : "",
          pins,
        },
      });
      setLibrary(await listCadDrawingsFn());
      setActiveId(meta.id);
      toast.success("Đã lưu vào thư viện bản vẽ.");
    } catch (err) {
      toast.error(errMessage(err, "Không lưu được bản vẽ."));
    } finally {
      setSaving(false);
    }
  }

  async function openLibrary(id: string) {
    try {
      const d = await getCadDrawingFn({ data: id });
      if (!d) {
        toast.error("Không tìm thấy bản vẽ.");
        return;
      }
      setActiveId(d.id);
      setSourceName(d.name);
      setFileName(d.fileName || `${d.name}.dxf`);
      setKind(d.kind === "LINK" ? "LINK" : d.kind === "PLANT" ? "PLANT" : "DXF");
      setDriveUrl(d.driveUrl);
      setHeThong(d.heThong);
      if (d.kind === "LINK") {
        toast.message("Bản vẽ DWG/DXF nằm trên Drive — mở link để xem trong AutoCAD.");
        return;
      }
      const text = d.dxfText || (d.kind === "PLANT" ? plantDxfText() : "");
      if (!text) {
        toast.error("Bản vẽ không có dữ liệu DXF.");
        return;
      }
      const parsed = d.kind === "PLANT" ? plantDoc : parseDxf(text);
      setDoc(parsed);
      setDxfText(text);
      setPins(d.pins.length ? d.pins : mergePins(pinsFromDxf(parsed), plantPins()));
    } catch (err) {
      toast.error(errMessage(err, "Không mở được bản vẽ."));
    }
  }

  async function saveLink() {
    if (!writable) return;
    const name = linkName.trim() || "Bản vẽ Drive";
    const url = driveUrl.trim();
    if (!url) {
      toast.error("Dán liên kết Google Drive của file DWG hoặc DXF.");
      return;
    }
    setSaving(true);
    try {
      const meta = await saveCadDrawingFn({
        data: {
          name,
          kind: "LINK",
          heThong,
          fileName: name,
          driveUrl: url,
          dxfText: "",
          pins: [],
        },
      });
      setLibrary(await listCadDrawingsFn());
      setActiveId(meta.id);
      setKind("LINK");
      toast.success("Đã gắn bản vẽ Drive. Mở link bằng AutoCAD / Drive.");
    } catch (err) {
      toast.error(errMessage(err, "Không lưu được link."));
    } finally {
      setSaving(false);
    }
  }

  async function persistPins(next: CadPin[]) {
    setPins(next);
    if (writable && activeId !== "plant" && activeId !== "local") {
      try {
        await saveCadPinsFn({ data: { id: activeId, pins: next } });
      } catch {
        /* local still updated */
      }
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-accent/30 bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold">Kết nối AutoCAD</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Xem sơ đồ công nghệ trạm ngay trên web, xuất DXF để mở bằng AutoCAD, hoặc nhập DXF đã Save As từ bản vẽ
              DWG. Gắn mã TB-xxx — bấm biểu tượng máy là ra lý lịch thiết bị.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setHelp((v) => !v)}>
            <HelpCircle className="size-3.5" />
            {help ? "Ẩn hướng dẫn" : "Cách kết nối"}
          </Button>
        </div>
        {help ? (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>
              Trong AutoCAD: <strong className="text-fg">File → Save As</strong> → loại{" "}
              <strong className="text-fg">AutoCAD DXF (*.dxf)</strong>, định dạng ASCII (không chọn Binary / DWG).
            </li>
            <li>
              <strong className="text-fg">Nhập DXF</strong> trên trang này — pan/zoom như model space. App tự nhận TEXT
              trùng mã TB-600-xx / TB-220-xx.
            </li>
            <li>
              <strong className="text-fg">Xuất DXF</strong> sơ đồ UMC → trên máy có AutoCAD: OPEN hoặc kéo file vào cửa
              sổ bản vẽ. Layer HE-600 / HE-220 / ONG / THIET-BI giữ nguyên.
            </li>
            <li>
              File <strong className="text-fg">DWG gốc</strong> (định dạng đóng Autodesk): để trong Drive{" "}
              <span className="font-mono text-xs">UMC_XLNT/06_Ban_ve_CAD</span> rồi dán link. Web không đọc được DWG.
            </li>
          </ol>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".dxf,.DXF,application/dxf,image/vnd.dxf,application/x-dxf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onPickFile(f);
          }}
        />
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          Nhập DXF
        </Button>
        <Button type="button" onClick={exportCurrent}>
          <Download className="size-4" />
          Xuất DXF
        </Button>
        <Button type="button" variant="secondary" onClick={loadPlant}>
          Sơ đồ UMC
        </Button>
        {writable ? (
          <Button type="button" variant="secondary" disabled={saving || kind === "LINK"} onClick={() => void saveCurrent()}>
            Lưu thư viện
          </Button>
        ) : null}
        <Button
          type="button"
          variant={pinMode ? "default" : "secondary"}
          disabled={!writable}
          onClick={() => setPinMode((v) => !v)}
        >
          <MapPin className="size-4" />
          {pinMode ? "Đang gắn mã" : "Gắn mã TB"}
        </Button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-xl border border-border shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{sourceName}</div>
              <div className="text-[11px] text-dim">
                {doc.entities.length} đối tượng · {doc.layers.length} layer · {pins.length} điểm gắn
                {missing ? ` · ${missing} mã không có trong danh mục` : ""}
              </div>
            </div>
            {pinMode ? (
              <Select value={pinTarget || undefined} onValueChange={setPinTarget}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Chọn thiết bị để gắn" />
                </SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => (
                    <SelectItem key={e.Equipment_ID} value={e.Equipment_ID}>
                      {e.Equipment_ID} · {e.Ten_thiet_bi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <CadViewer
            className="h-[min(70vh,640px)] w-full"
            doc={doc}
            hiddenLayers={layers.hidden}
            pins={pins}
            selectedId={selectedId}
            pinMode={pinMode}
            onSelectPin={(id) => {
              setSelectedId(id ?? undefined);
              setPinMode(false);
            }}
            onPlacePin={(x, y) => {
              if (!pinTarget) {
                toast.error("Chọn mã thiết bị trước khi chạm lên bản vẽ.");
                return;
              }
              const next = mergePins(pins, [{ equipmentId: pinTarget, x, y }]);
              void persistPins(next);
              setSelectedId(pinTarget);
              toast.success(`Đã gắn ${pinTarget}.`);
            }}
          />
        </div>

        <aside className="space-y-3">
          {selected ? (
            <div className="rounded-xl border border-border bg-surface p-3 shadow-panel">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-accent">{selected.Equipment_ID}</div>
                  <div className="text-sm font-semibold">{selected.Ten_thiet_bi}</div>
                </div>
                <Badge variant={statusVariant(selected.Tinh_trang)}>{EQ_TT[selected.Tinh_trang]}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted">
                {selected.He_thong === "He_600" ? "Hệ 600" : "Hệ 220"}
                {selected.Hang_SX ? ` · ${selected.Hang_SX}` : ""}
                {selected.Model ? ` ${selected.Model}` : ""}
              </p>
              {selected.Thong_so ? <p className="mt-1 text-xs text-muted">{selected.Thong_so}</p> : null}
              <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
                <Link to="/app/thietbi">
                  <Wrench className="size-3.5" />
                  Mở danh mục thiết bị
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-3 text-sm text-muted">
              Bấm một mã TB trên bản vẽ để xem lý lịch và tình trạng.
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-dim">Layer</div>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
              {layers.names.map((name) => {
                const on = !layers.hidden.has(name);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left",
                        on ? "text-fg hover:bg-mint" : "text-dim line-through hover:bg-mint/50",
                      )}
                      onClick={() => layers.toggle(name)}
                    >
                      <span className={cn("size-2 rounded-full", on ? "bg-accent" : "bg-border-strong")} />
                      <span className="font-mono text-[11px]">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-dim">
              <FolderOpen className="size-3.5" />
              Thư viện
            </div>
            <ul className="mt-2 space-y-1">
              <li>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm",
                    activeId === "plant" ? "bg-mint font-medium" : "hover:bg-mint/70",
                  )}
                  onClick={loadPlant}
                >
                  Sơ đồ công nghệ UMC
                </button>
              </li>
              {library.map((d) => (
                <li key={d.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={cn(
                      "min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm",
                      activeId === d.id ? "bg-mint font-medium" : "hover:bg-mint/70",
                    )}
                    onClick={() => void openLibrary(d.id)}
                  >
                    <span className="block truncate">{d.name}</span>
                    <span className="block text-[11px] text-dim">
                      {d.kind === "LINK" ? "Link Drive" : `${d.entityCount} ĐT`} · {d.heThong === "CHUNG" ? "chung" : d.heThong.replace("He_", "Hệ ")}
                    </span>
                  </button>
                  {writable ? (
                    <button
                      type="button"
                      className="size-8 shrink-0 rounded-md text-dim hover:bg-mint hover:text-bad"
                      aria-label="Xóa"
                      onClick={() => {
                        void deleteCadDrawingFn({ data: d.id })
                          .then(async () => {
                            setLibrary(await listCadDrawingsFn());
                            if (activeId === d.id) loadPlant();
                            toast.success("Đã xóa bản vẽ.");
                          })
                          .catch((err) => toast.error(errMessage(err, "Không xóa được.")));
                      }}
                    >
                      <Trash2 className="mx-auto size-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {!library.length ? <p className="mt-2 text-xs text-dim">Chưa có file tải lên — dùng sơ đồ UMC hoặc nhập DXF.</p> : null}
          </div>

          {writable ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-dim">
                <Link2 className="size-3.5" />
                DWG trên Drive
              </div>
              <Label className="text-xs">Tên</Label>
              <Input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="P&ID hệ 600 — DWG" />
              <Label className="text-xs">Link Drive</Label>
              <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" />
              <Select value={heThong} onValueChange={(v) => setHeThong(v as typeof heThong)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHUNG">Cả trạm</SelectItem>
                  <SelectItem value="He_600">Hệ 600</SelectItem>
                  <SelectItem value="He_220">Hệ 220</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" className="w-full" disabled={saving} onClick={() => void saveLink()}>
                Gắn link AutoCAD
              </Button>
              {driveUrl.trim().startsWith("http") ? (
                <a
                  href={driveUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs text-accent hover:underline"
                >
                  Mở trên Drive
                </a>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
