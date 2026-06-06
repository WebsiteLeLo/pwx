import { useEffect, useMemo, useState, useRef } from "react";
import { useScheduleDetails, useAttachmentUrls, type AttachmentUrlItem } from "@/hooks/usePWApi";
import { DrmPlayer } from "@/components/DrmPlayer";

const ACCENT = "#5a4bda";
const NOTE_COLOR = "#3ecfcf";
const DPP_COLOR = "#ff9f43";

function isDpp(topic: string) {
  return /dpp/i.test(topic);
}

function PdfRow({ item, color }: { item: AttachmentUrlItem; color: string }) {
  const noteSvg = (
    <svg viewBox="0 0 24 24" width="12" height="12" style={{ fill: color }}>
      <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/>
    </svg>
  );
  const dppSvg = (
    <svg viewBox="0 0 24 24" width="12" height="12" style={{ fill: color }}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
    </svg>
  );

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="flex-1 text-[13px] leading-snug break-words min-w-0" style={{ color: "#e8e8f0" }}>
        {item.topic || "View PDF"}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "rgba(255,255,255,.75)",
          }}
          title="Open in new tab"
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
          </svg>
        </a>
        <a
          href={item.url}
          download
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "rgba(255,255,255,.75)",
          }}
          title="Download"
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

function AttachGroup({
  items, label, color, dotClass, iconLabel,
}: {
  items: AttachmentUrlItem[];
  label: string;
  color: string;
  dotClass: string;
  iconLabel: string;
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-[10px] overflow-hidden mb-2.5" style={{ background: "#1c1c27", border: "1px solid rgba(255,255,255,.1)" }}>
      <div className="flex items-center justify-between px-3.5 py-3 cursor-pointer" style={{ gap: "8px" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}22` }}>
            {label === "Notes" ? (
              <svg viewBox="0 0 24 24" width="12" height="12" style={{ fill: color }}>
                <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="12" height="12" style={{ fill: color }}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
            )}
          </div>
          <span className="text-[13px] font-bold tracking-[.6px] uppercase" style={{ color }}>
            {label}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color }}>
            {items.length}
          </span>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
        {items.map((item, i) => (
          <PdfRow key={i} item={item} color={color} />
        ))}
      </div>
    </div>
  );
}

type PanelTab = "tl" | "att";

function SidePanel({
  open,
  onClose,
  activeTab,
  onTabChange,
  notes,
  dpps,
  loading,
  title,
}: {
  open: boolean;
  onClose: () => void;
  activeTab: PanelTab;
  onTabChange: (t: PanelTab) => void;
  notes: AttachmentUrlItem[];
  dpps: AttachmentUrlItem[];
  loading: boolean;
  title?: string;
}) {
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#111118", borderLeft: "1px solid rgba(255,255,255,.1)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <span className="text-base font-bold" style={{ color: "#e8e8f0" }}>
          {activeTab === "tl" ? "Timeline" : "Attachments"}
        </span>
        <button
          className="flex items-center p-1 rounded-md bg-transparent border-none cursor-pointer"
          style={{ color: "#7070a0" }}
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        {(["tl", "att"] as PanelTab[]).map((tab) => (
          <button
            key={tab}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[13px] font-semibold bg-transparent border-none cursor-pointer transition-colors"
            style={{
              color: activeTab === tab ? "#fff" : "#7070a0",
              borderBottom: `2px solid ${activeTab === tab ? ACCENT : "transparent"}`,
            }}
            onClick={() => onTabChange(tab)}
          >
            {tab === "tl" ? (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3.167 5.583a.083.083 0 01.166 0v12.834a.083.083 0 01-.167 0V5.583zM5.667 17.333a1 1 0 001 1h10.666a1 1 0 001-1V6.667a1 1 0 00-1-1H6.667a1 1 0 00-1 1v10.666zm4.888-3.3V9.966L13.945 12l-3.39 2.034zM20.666 5.583a.083.083 0 11.167 0v12.834a.083.083 0 01-.166 0V5.583z"/>
                </svg>
                Timeline
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
                Attachments
              </>
            )}
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,.12) transparent",
        }}
      >
        {activeTab === "tl" && (
          <div className="p-3">
            {title && (
              <div className="mb-3 px-1">
                <p className="text-[13px] font-medium" style={{ color: "#e8e8f0", lineHeight: 1.5 }}>{title}</p>
              </div>
            )}
            <div className="text-center py-10" style={{ color: "#7070a0", fontSize: "14px" }}>
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
                <path d="M3.167 5.583a.083.083 0 01.166 0v12.834a.083.083 0 01-.167 0V5.583zM5.667 17.333a1 1 0 001 1h10.666a1 1 0 001-1V6.667a1 1 0 00-1-1H6.667a1 1 0 00-1 1v10.666zm4.888-3.3V9.966L13.945 12l-3.39 2.034zM20.666 5.583a.083.083 0 11.167 0v12.834a.083.083 0 01-.166 0V5.583z"/>
              </svg>
              No timeline available for this lecture
            </div>
          </div>
        )}

        {activeTab === "att" && (
          <div className="p-3">
            {loading ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,.06)" }} />
                ))}
              </div>
            ) : (notes.length === 0 && dpps.length === 0) ? (
              <div className="text-center py-10" style={{ color: "#7070a0", fontSize: "14px" }}>
                No attachments available
              </div>
            ) : (
              <>
                <AttachGroup items={notes} label="Notes" color={NOTE_COLOR} dotClass="nd" iconLabel="Notes" />
                <AttachGroup items={dpps} label="DPP" color={DPP_COLOR} dotClass="dd" iconLabel="DPP" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type PlayerMode = "drm" | "rarestudy";

export default function ScheduleWatch() {
  const [params, setParams] = useState({ batchId: "", subjectId: "", scheduleId: "" });
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("att");
  const [isMobile, setIsMobile] = useState(false);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("drm");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      batchId: sp.get("batchId") || "",
      subjectId: sp.get("subjectId") || "",
      scheduleId: sp.get("scheduleId") || "",
    });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleDetails(
    params.batchId, params.subjectId, params.scheduleId
  );
  const schedule = scheduleData?.data;
  const videoTitle = schedule?.topic || schedule?.videoDetails?.name || "";

  const { data: attachmentData, isLoading: attachmentLoading } = useAttachmentUrls(
    params.batchId, params.subjectId, params.scheduleId
  );
  const allPdfs = useMemo(() => attachmentData ?? [], [attachmentData]);
  const notes = useMemo(() => allPdfs.filter((a) => !isDpp(a.topic)), [allPdfs]);
  const dpps  = useMemo(() => allPdfs.filter((a) => isDpp(a.topic)), [allPdfs]);

  const hasParams = !!(params.batchId && params.scheduleId);

  const rarestudyUrl = hasParams
    ? `https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(params.batchId)}&subjectId=${encodeURIComponent(params.subjectId)}&scheduleId=${encodeURIComponent(params.scheduleId)}&tap=video`
    : "";

  function openPanel(tab: PanelTab) {
    setActiveTab(tab);
    setPanelOpen(true);
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col"
      style={{ background: "#000", fontFamily: "'DM Sans', -apple-system, sans-serif", color: "#e8e8f0" }}
    >
      {/* Main row */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Video column */}
        <div className="flex-1 min-w-0 relative flex flex-col overflow-hidden" style={{ background: "#000" }}>
          {hasParams ? (
            <>
              {/* Player toggle */}
              <div
                className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex gap-1 rounded-full px-1 py-1"
                style={{ background: "rgba(0,0,0,.70)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.1)" }}
              >
                {(["drm", "rarestudy"] as PlayerMode[]).map((mode, i) => (
                  <button
                    key={mode}
                    onClick={() => setPlayerMode(mode)}
                    className="text-xs px-3 py-1 rounded-full transition-colors font-medium"
                    style={{
                      background: playerMode === mode ? ACCENT : "transparent",
                      color: playerMode === mode ? "#fff" : "rgba(255,255,255,.5)",
                    }}
                  >
                    Player {i + 1}
                  </button>
                ))}
              </div>

              {/* DRM player */}
              <div className="absolute inset-0" style={{ display: playerMode === "drm" ? "block" : "none" }}>
                <DrmPlayer
                  batchId={params.batchId}
                  subjectId={params.subjectId}
                  childId={params.scheduleId}
                  poster={schedule?.videoDetails?.image}
                  title={videoTitle}
                  onOpenTimeline={() => openPanel("tl")}
                  onOpenAttachments={() => openPanel("att")}
                />
              </div>

              {/* Rarestudy.in player */}
              {playerMode === "rarestudy" && (
                <iframe
                  key={rarestudyUrl}
                  src={rarestudyUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  title={videoTitle}
                />
              )}
            </>
          ) : scheduleLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "rgba(0,0,0,.82)" }}>
              <div className="w-10 h-10 rounded-full border-[3px] animate-spin" style={{ borderColor: "rgba(90,75,218,.18)", borderTopColor: ACCENT }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,.65)" }}>Loading…</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4" style={{ background: "rgba(0,0,0,.88)" }}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5">
                <path d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"/>
              </svg>
              <p className="text-sm text-center" style={{ color: "#7070a0" }}>Invalid video parameters. Please go back and select a video.</p>
              <button
                className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ background: ACCENT, color: "#fff" }}
                onClick={() => window.history.back()}
              >
                Go Back
              </button>
            </div>
          )}
        </div>

        {/* Side panel — desktop only */}
        <div
          className="hidden lg:flex flex-col flex-shrink-0 overflow-hidden transition-all duration-300"
          style={{
            width: panelOpen ? "340px" : "0",
            borderLeft: panelOpen ? "1px solid rgba(255,255,255,.1)" : "none",
          }}
        >
          {panelOpen && (
            <SidePanel
              open={panelOpen}
              onClose={() => setPanelOpen(false)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              notes={notes}
              dpps={dpps}
              loading={attachmentLoading}
              title={videoTitle}
            />
          )}
        </div>
      </div>

      {/* Bottom panel — mobile only */}
      <div
        className="lg:hidden flex-shrink-0 overflow-hidden transition-all duration-300"
        style={{
          height: panelOpen ? "50vh" : "0",
          borderTop: panelOpen ? "1px solid rgba(255,255,255,.1)" : "none",
        }}
      >
        {panelOpen && (
          <SidePanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            notes={notes}
            dpps={dpps}
            loading={attachmentLoading}
            title={videoTitle}
          />
        )}
      </div>
    </div>
  );
}
