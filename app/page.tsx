// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Search, FolderOpen, FileSpreadsheet, ExternalLink,
  Users, AlertCircle, RefreshCw, Brain, BarChart3,
  ListChecks, Crosshair, Activity, Database, Loader,
} from "lucide-react";

const T = {
  bg:          "#fdf8f2",
  surface:     "#faf5ed",
  surfaceHi:   "#f3ebe0",
  surfaceMid:  "#ede3d4",
  border:      "#e0d4c0",
  borderSoft:  "#ece4d6",
  ink:         "#2c2018",
  inkSoft:     "#6b5a46",
  inkFaint:    "#a8937a",
  inkFainter:  "#c8b89e",
  accent:      "#c4956a",
  accentDark:  "#9a7052",
  accentLight: "#f0dfc8",
  accentFaint: "#f8f0e6",
  ok:          "#5a8a5a",
  okBg:        "#eaf2ea",
  warn:        "#a07820",
  warnBg:      "#faf0d8",
  bad:         "#8a4a3a",
  badBg:       "#f5ebe6",
  sideW:       "272px",
};

const normalize  = (v: unknown) => String(v ?? "").trim();
const normalizeK = (v: unknown) => normalize(v).toLowerCase();

const firstVal = (row: Record<string, unknown>, keys: string[]) => {
  for (const k of Object.keys(row))
    if (keys.some((c) => normalizeK(k) === normalizeK(c))) return row[k];
  return "";
};

const fmtDate = (raw: unknown) => {
  if (!raw) return "—";
  if (raw instanceof Date) return raw.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const s = String(raw).trim();
  if (!s || s === "0") return "—";
  try { const d = new Date(s); if (!isNaN(d.getTime())) return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); } catch { /**/ }
  return s;
};

const inferRave = (label) => {
  const m = String(label ?? "").match(/([A-Za-z]+)(\d+)/);
  return m ? `${m[1]}${m[2].padStart(3, "0")}.html` : "";
};

const GROUPS = [
  { key: "baseline_closed",  label: "Baseline — Eyes Closed",    pat: ["baseline eyes closed"] },
  { key: "baseline_open",    label: "Baseline — Eyes Open",      pat: ["baseline eyes open"]   },
  { key: "baseline_other",   label: "Baseline (other)",          pat: ["baseline"]              },
  { key: "dynamic_range",    label: "Dynamic Range",             pat: ["dynamic range"]         },
  { key: "beta_desync",      label: "Beta Desync",               pat: ["beta desync"]           },
  { key: "contra_random",    label: "Contralateral Random",      pat: ["contralateral random"]  },
  { key: "contra_sequence",  label: "Contralateral Sequence",    pat: ["contralateral sequence"]},
  { key: "contra_irregular", label: "Contralateral Irregular",   pat: ["contralateral irregular"]},
  { key: "ipsilateral",      label: "Ipsilateral Hand",          pat: ["ipsilateral"]           },
  { key: "open_loop",        label: "Open Loop",                 pat: ["open loop","open-loop"] },
  { key: "closed_loop",      label: "Closed Loop",               pat: ["closed loop"]           },
  { key: "gestures",         label: "Gestures",                  pat: ["gesture"]               },
  { key: "digits",           label: "Digit Paced",               pat: ["digit"]                 },
  { key: "breakdance",       label: "Breakdance",                pat: ["breakdance"]            },
  { key: "validation",       label: "Validation",                pat: ["validation"]            },
  { key: "irregular_train",  label: "Irregular Training",        pat: ["irregular training"]    },
  { key: "speech",           label: "Speech Control",            pat: ["speech"]                },
  { key: "arm_reach",        label: "Arm Reach",                 pat: ["arm reach"]             },
  { key: "passive",          label: "Passive Movement",          pat: ["passive"]               },
  { key: "stimulation",      label: "Stimulation (SSEP)",        pat: ["stimulation"]           },
  { key: "mer",              label: "MER Recording",             pat: ["mer recording","mer "]  },
  { key: "dbs",              label: "DBS",                       pat: ["dbs"]                   },
  { key: "robot",            label: "Robot Tasks",               pat: ["robot"]                 },
  { key: "self_paced",       label: "Self-Paced",                pat: ["self paced","self-paced"]},
  { key: "calibration",      label: "Calibration",              pat: ["calibration"]           },
  { key: "rock_paper",       label: "Rock / Paper",              pat: ["rock","paper"]          },
];

const groupOf = (name) => {
  const lower = normalizeK(name);
  for (const g of GROUPS) if (g.pat.some((p) => lower.includes(p))) return g.key;
  return "other";
};
const labelOf = (key) => GROUPS.find((g) => g.key === key)?.label ?? "Other";

const parseWb = (buffer) => {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const cs = wb.Sheets["Control"];
  if (!cs) throw new Error("Missing 'Control' sheet in workbook");
  const ctrlRows = XLSX.utils.sheet_to_json(cs, { defval: "" });
  const patientMap = {};
  const taskSet = new Set();
  const targetSet = new Set();
  for (const row of ctrlRows) {
    const caseId = normalize(firstVal(row, ["Case"]));
    const label  = normalize(firstVal(row, ["Label"]));
    if (!caseId || !label || label.toLowerCase().includes("declined")) continue;
    const sheet = wb.Sheets[label];
    const taskRows = sheet
      ? XLSX.utils.sheet_to_json(sheet, { defval: "" }).filter((r) => Object.values(r).some((v) => normalize(v)))
      : [];
    for (const tr of taskRows) { const tn = normalize(firstVal(tr, ["Tasks","Task"])); if (tn) taskSet.add(tn); }
    const site = normalize(firstVal(row, ["Site"]));
    if (site) targetSet.add(site);
    const dateRaw = firstVal(row, ["Date (mm/dd/year)","Date"]);
    patientMap[caseId] = {
      caseId, label,
      num: parseInt(String(label).match(/\d+/)?.[0] ?? "0"),
      displayName: label,
      ecog:              normalize(firstVal(row, ["ECOG"])),
      dateRaw, date:     fmtDate(dateRaw),
      dbsSide:           normalize(firstVal(row, ["DBS Side"])),
      condition:         normalize(firstVal(row, ["Condition"])),
      site,
      mer:               normalize(firstVal(row, ["MER"])),
      uploadedBox:       normalize(firstVal(row, ["Uploaded to Box"])),
      uploadedBrains:    normalize(firstVal(row, ["Uploaded to Brains"])),
      localization:      normalize(firstVal(row, ["Localization"])),
      raveLink:          normalize(firstVal(row, ["Rave Link"])),
      diagnosis:         normalize(firstVal(row, ["Diagnosis"])),
      taskRows,
      raveName: inferRave(label),
    };
  }
  const patients = Object.values(patientMap).sort((a, b) => a.num - b.num);
  const byTask = {}, byTarget = {};
  for (const p of patients) {
    const seen = new Set();
    for (const tr of p.taskRows) {
      const tn = normalize(firstVal(tr, ["Tasks","Task"]));
      if (!tn || seen.has(tn)) continue;
      seen.add(tn);
      (byTask[tn] ??= []).push(p);
    }
    if (p.site) (byTarget[p.site] ??= []).push(p);
  }
  const taskGroupMap = {};
  for (const tn of taskSet) {
    const gk = groupOf(tn);
    (taskGroupMap[gk] ??= { key: gk, tasks: [] }).tasks.push(tn);
  }
  return {
    patientMap, patients, byTask, byTarget, taskGroupMap,
    allTargets: Array.from(targetSet).sort(),
    stats: { patients: patients.length, tasks: taskSet.size, targets: targetSet.size, withRave: patients.filter((p) => p.raveName).length },
  };
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400;1,500&family=Source+Sans+3:wght@300;400;500;600&family=Source+Code+Pro:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #fdf8f2; color: #2c2018; font-family: 'Source Sans 3', sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 7px; height: 7px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #ede3d4; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #c8b89e; }
  input, select { outline: none; font-family: inherit; }
  input:focus { border-color: #c4956a !important; }
  button { font-family: inherit; cursor: pointer; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Tag = ({ children, strong }) => (
  <span style={{ display:"inline-block", background: strong ? T.accentLight : T.surfaceHi, color: strong ? T.accentDark : T.inkSoft, border:`1px solid ${strong ? T.accent : T.border}`, borderRadius:20, fontSize:11.5, padding:"2px 10px", whiteSpace:"nowrap", fontFamily:"'Source Sans 3',sans-serif", fontWeight:400 }}>{children}</span>
);

const StatusPip = ({ val }) => {
  const v = normalizeK(val);
  if (v==="yes"||v==="done") return <span style={{color:T.ok,fontSize:11,fontFamily:"monospace"}}>● yes</span>;
  if (v==="no")              return <span style={{color:T.bad,fontSize:11,fontFamily:"monospace"}}>● no</span>;
  if (v==="pending")         return <span style={{color:T.warn,fontSize:11,fontFamily:"monospace"}}>◑ pending</span>;
  return <span style={{color:T.inkFainter,fontSize:11,fontFamily:"monospace"}}>○ —</span>;
};

const ProcTag = ({ val }) => {
  const v = normalizeK(val ?? "");
  const bg  = v==="done" ? T.okBg : v==="pending" ? T.warnBg : T.surfaceHi;
  const col = v==="done" ? T.ok   : v==="pending" ? T.warn   : T.inkFaint;
  const txt = v==="done" ? "done" : v==="pending" ? "pending" : v==="n/a" ? "n/a" : v||"—";
  return <span style={{ background:bg, color:col, fontFamily:"'Source Code Pro',monospace", fontSize:10.5, padding:"2px 7px", borderRadius:3, textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{txt}</span>;
};

const Divider = ({ label }) => (
  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 0 14px" }}>
    <span style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:19, color:T.ink, fontWeight:400, whiteSpace:"nowrap" }}>{label}</span>
    <div style={{ flex:1, height:1, background:T.border }} />
  </div>
);

const PipelineRow = ({ p }) => {
  const fields = [["Box",p.uploadedBox],["Brains",p.uploadedBrains],["Loc.",p.localization],["RAVE",p.raveLink],["Dx",p.diagnosis]];
  return (
    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
      {fields.map(([lbl,v]) => {
        const ok=normalizeK(v)==="yes"||normalizeK(v)==="done", no=normalizeK(v)==="no";
        return <div key={lbl} style={{ background:ok?T.okBg:no?T.badBg:T.surfaceHi, color:ok?T.ok:no?T.bad:T.inkFaint, border:`1px solid ${ok?"#c0dac0":no?"#d8c0b8":T.border}`, borderRadius:5, padding:"4px 10px", fontSize:11, fontFamily:"'Source Code Pro',monospace", display:"flex", alignItems:"center", gap:5 }}><span>{ok?"✓":no?"✕":"–"}</span>{lbl}</div>;
      })}
    </div>
  );
};

const PatientTaskGroup = ({ gk, tasksMap }) => {
  const [open, setOpen] = useState(false);
  const taskNames = Object.keys(tasksMap);
  const allRows   = Object.values(tasksMap).flat();
  return (
    <div style={{ border:`1px solid ${T.border}`, borderRadius:8, marginBottom:5, overflow:"hidden", background: open?T.bg:T.surface, transition:"background 0.2s" }}>
      <div onClick={() => setOpen(!open)}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", cursor:"pointer", borderBottom: open?`1px solid ${T.border}`:"none" }}
        onMouseEnter={(e) => e.currentTarget.style.background=T.accentFaint}
        onMouseLeave={(e) => e.currentTarget.style.background="transparent"}
      >
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ color:T.accent, fontSize:11, userSelect:"none" }}>{open?"▾":"▸"}</span>
          <span style={{ fontFamily:"'Source Sans 3',sans-serif", fontSize:13.5, color:T.ink, fontWeight:500 }}>{labelOf(gk)}</span>
          {taskNames.length>1 && <span style={{ fontSize:11, color:T.inkFaint, fontFamily:"'Source Code Pro',monospace" }}>{taskNames.length} entries</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          {allRows.map((row,i) => { const v=normalizeK(firstVal(row,["Processing"])); return <span key={i} style={{ color:v==="done"?T.ok:v==="pending"?T.warn:T.inkFainter, fontSize:8 }}>●</span>; })}
        </div>
      </div>
      {open && (
        <div style={{ padding:"10px 14px 14px" }}>
          {taskNames.map((tn) => (
            <div key={tn} style={{ marginBottom:taskNames.length>1?14:0 }}>
              {taskNames.length>1 && <div style={{ fontSize:10.5, color:T.accent, fontFamily:"'Source Code Pro',monospace", marginBottom:7, textTransform:"uppercase", letterSpacing:"0.08em" }}>{tn}</div>}
              {tasksMap[tn].map((row,ri) => {
                const file=normalize(firstVal(row,["Thalamus File","Hydrated Thalamus File"]));
                const notes=normalize(firstVal(row,["Considerations","Notes on Task","Notes"]));
                const trials=normalize(firstVal(row,["Time / Number of Trials"]));
                const prepNo=normalize(firstVal(row,["Preprocessing Number"]));
                const proc=normalize(firstVal(row,["Processing"]));
                const badIdx=normalize(firstVal(row,["Bad Event Indices"]));
                return (
                  <div key={ri} style={{ background:T.surfaceHi, borderRadius:6, border:`1px solid ${T.borderSoft}`, padding:"10px 12px", marginBottom:ri<tasksMap[tn].length-1?5:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                      <ProcTag val={proc} />
                      {prepNo&&prepNo!=="—"&&<span style={{ fontSize:10.5, color:T.inkFaint, fontFamily:"'Source Code Pro',monospace" }}>#{prepNo}</span>}
                    </div>
                    <dl style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"4px 14px", margin:0, fontSize:12.5 }}>
                      {trials&&<><dt style={{color:T.inkFaint,fontFamily:"'Source Code Pro',monospace",fontSize:10}}>Trials</dt><dd style={{color:T.inkSoft,margin:0}}>{trials}</dd></>}
                      {file&&<><dt style={{color:T.inkFaint,fontFamily:"'Source Code Pro',monospace",fontSize:10}}>File</dt><dd style={{color:T.inkFaint,margin:0,fontFamily:"'Source Code Pro',monospace",fontSize:10.5,wordBreak:"break-all"}}>{file}</dd></>}
                      {notes&&<><dt style={{color:T.inkFaint,fontFamily:"'Source Code Pro',monospace",fontSize:10}}>Notes</dt><dd style={{color:T.warn,margin:0,fontSize:12}}>{notes}</dd></>}
                      {badIdx&&badIdx!=="n/a"&&badIdx!=="—"&&<><dt style={{color:T.inkFaint,fontFamily:"'Source Code Pro',monospace",fontSize:10}}>Bad idx</dt><dd style={{color:T.bad,margin:0,fontFamily:"'Source Code Pro',monospace",fontSize:10.5,wordBreak:"break-all"}}>{badIdx}</dd></>}
                    </dl>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PatientTasks = ({ patient }) => {
  const groups = {};
  for (const row of patient.taskRows) {
    const tn = normalize(firstVal(row, ["Tasks","Task"]));
    if (!tn) continue;
    const gk = groupOf(tn);
    (groups[gk] ??= {})[tn] ??= [];
    groups[gk][tn].push(row);
  }
  return <div>{Object.entries(groups).map(([gk,tm]) => <PatientTaskGroup key={gk} gk={gk} tasksMap={tm} />)}</div>;
};

const TinyBtnBox = ({ icon, title }) => (
  <div title={title} style={{ padding:"5px 9px", borderRadius:5, display:"flex", alignItems:"center", border:`1px solid ${T.border}`, background:T.bg, color:T.inkSoft, transition:"all 0.15s" }}
    onMouseEnter={(e) => { e.currentTarget.style.background=T.accentLight; e.currentTarget.style.color=T.accentDark; }}
    onMouseLeave={(e) => { e.currentTarget.style.background=T.bg; e.currentTarget.style.color=T.inkSoft; }}
  >{icon}</div>
);
const TinyBtn = ({ icon, onClick, title }) => <div onClick={onClick}><TinyBtnBox icon={icon} title={title} /></div>;

const RaveViewer = ({ patient, raveUrl, onManualLoad }) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading]     = useState(false);
  useEffect(() => { if (raveUrl) setLoading(true); }, [raveUrl, reloadKey]);
  return (
    <div style={{ border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", background:T.surfaceHi, borderBottom:`1px solid ${T.border}`, gap:10 }}>
        <span style={{ fontSize:12, color:raveUrl?T.ok:T.inkFaint, fontFamily:"'Source Code Pro',monospace" }}>{raveUrl?`● ${patient.raveName}`:`○ ${patient.raveName||"no file"}`}</span>
        <div style={{ display:"flex", gap:6 }}>
          {raveUrl && <TinyBtn icon={<RefreshCw size={12}/>} onClick={() => { setLoading(true); setReloadKey(k=>k+1); }} title="Reload" />}
          {raveUrl && <TinyBtn icon={<ExternalLink size={12}/>} onClick={() => window.open(raveUrl,"_blank")} title="Open in new tab" />}
          <label style={{ cursor:"pointer" }}>
            <TinyBtnBox icon={<FolderOpen size={12}/>} title="Load file manually" />
            <input type="file" accept=".html,.htm" style={{ display:"none" }} onChange={(e) => { const f=e.target.files?.[0]; if(f) onManualLoad(f); }} />
          </label>
        </div>
      </div>
      <div style={{ position:"relative", height:680, background:"#f8f3ec" }}>
        {raveUrl ? (
          <>
            {loading && (
              <div style={{ position:"absolute", inset:0, zIndex:5, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"rgba(253,248,242,0.9)", gap:12 }}>
                <Loader size={20} color={T.accent} style={{ animation:"spin 1s linear infinite" }} />
                <span style={{ color:T.inkFaint, fontFamily:"'Source Code Pro',monospace", fontSize:11, textTransform:"uppercase", letterSpacing:"0.12em" }}>Rendering reconstruction…</span>
              </div>
            )}
            <iframe key={`${patient.caseId}-${reloadKey}`} src={raveUrl} sandbox="allow-scripts allow-same-origin" style={{ width:"100%", height:"100%", border:"none" }} onLoad={() => setLoading(false)} />
          </>
        ) : (
          <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:32, textAlign:"center" }}>
            <Brain size={36} color={T.inkFainter} strokeWidth={1} />
            <div style={{ color:T.inkFaint, fontFamily:"'Source Code Pro',monospace", fontSize:11, textTransform:"uppercase", letterSpacing:"0.15em" }}>No reconstruction loaded</div>
            <div style={{ color:T.inkFaint, fontSize:13, maxWidth:400, lineHeight:1.7 }}>
              Expected: <code style={{ color:T.inkSoft, background:T.surfaceHi, padding:"1px 6px", borderRadius:3, fontFamily:"'Source Code Pro',monospace" }}>{patient.raveName}</code><br/>
              Use <strong style={{ color:T.inkSoft }}>Link RAVE folder</strong> in the header, or click the folder icon above.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TasksBrowse = ({ parsed }) => {
  const [selGk, setSelGk] = useState(null);
  const [search, setSearch] = useState("");
  const groups = Object.entries(parsed.taskGroupMap)
    .map(([gk,info]) => { const pts=new Set(info.tasks.flatMap((tn)=>(parsed.byTask[tn]??[]).map((p)=>p.caseId))).size; return {gk,pts,tasks:info.tasks}; })
    .filter((g) => !search||labelOf(g.gk).toLowerCase().includes(search))
    .sort((a,b) => b.pts-a.pts);
  const sel = groups.find((g) => g.gk===selGk);
  const selPts = sel ? [...new Map(sel.tasks.flatMap((tn)=>(parsed.byTask[tn]??[]).map((p)=>[p.caseId,p]))).values()] : [];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:18, minHeight:400 }}>
      <div>
        <div style={{ position:"relative", marginBottom:10 }}>
          <Search size={11} color={T.inkFaint} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)" }} />
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Filter…" style={{ width:"100%", padding:"7px 8px 7px 28px", background:T.surfaceHi, border:`1px solid ${T.border}`, borderRadius:6, color:T.ink, fontSize:12.5 }} />
        </div>
        {groups.map((g) => (
          <div key={g.gk} onClick={()=>setSelGk(g.gk===selGk?null:g.gk)}
            style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderRadius:7, cursor:"pointer", marginBottom:3, background:selGk===g.gk?T.accentLight:"transparent", border:`1px solid ${selGk===g.gk?T.accent:"transparent"}`, transition:"all 0.15s" }}
            onMouseEnter={(e) => { if(selGk!==g.gk) e.currentTarget.style.background=T.surfaceHi; }}
            onMouseLeave={(e) => { if(selGk!==g.gk) e.currentTarget.style.background="transparent"; }}
          >
            <span style={{ fontSize:12.5, color:selGk===g.gk?T.accentDark:T.ink }}>{labelOf(g.gk)}</span>
            <span style={{ fontSize:10.5, fontFamily:"'Source Code Pro',monospace", color:selGk===g.gk?T.accentDark:T.inkFaint, background:selGk===g.gk?"rgba(196,149,106,0.18)":T.surfaceHi, padding:"1px 7px", borderRadius:8 }}>{g.pts}</span>
          </div>
        ))}
      </div>
      <div>
        {sel ? (
          <>
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px 18px", marginBottom:14 }}>
              <div style={{ fontFamily:"'Lora',serif", fontSize:20, fontStyle:"italic", color:T.ink, marginBottom:6 }}>{labelOf(sel.gk)}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                {sel.tasks.map((tn) => <span key={tn} style={{ fontSize:10.5, color:T.inkFaint, fontFamily:"'Source Code Pro',monospace", background:T.surfaceHi, padding:"2px 7px", borderRadius:3 }}>{tn}</span>)}
              </div>
              <div style={{ fontSize:13, color:T.inkSoft }}>Performed by <strong style={{ color:T.accent }}>{sel.pts}</strong> {sel.pts===1?"patient":"patients"}</div>
            </div>
            {selPts.sort((a,b)=>a.num-b.num).map((p) => (
              <div key={p.caseId} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", marginBottom:5, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"'Lora',serif", fontSize:15, color:T.ink }}>{p.displayName}</div>
                  <div style={{ fontSize:11.5, color:T.inkFaint, marginTop:2 }}>{[p.date,p.site,p.condition].filter(Boolean).join(" · ")}</div>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  {sel.tasks.map((tn) => { const row=p.taskRows.find((r)=>normalizeK(firstVal(r,["Tasks","Task"]))===normalizeK(tn)); return row?<ProcTag key={tn} val={firstVal(row,["Processing"])}/>:null; })}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div style={{ minHeight:200, display:"flex", alignItems:"center", justifyContent:"center", color:T.inkFainter, fontStyle:"italic", fontFamily:"'Lora',serif", fontSize:15, border:`1px dashed ${T.border}`, borderRadius:10, padding:30, textAlign:"center" }}>Select a task group to see which patients performed it</div>
        )}
      </div>
    </div>
  );
};

const TargetsBrowse = ({ parsed }) => {
  const [sel, setSel] = useState(parsed.allTargets[0]??null);
  const pts = sel?(parsed.byTarget[sel]??[]):[];
  const byCond = pts.reduce((a,p)=>{a[p.condition||"?"]=(a[p.condition||"?"]??0)+1;return a;},{});
  const bySide = pts.reduce((a,p)=>{a[p.dbsSide||"?"]=(a[p.dbsSide||"?"]??0)+1;return a;},{});
  return (
    <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:18 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {parsed.allTargets.map((t) => { const count=(parsed.byTarget[t]??[]).length, active=sel===t; return (
          <div key={t} onClick={()=>setSel(t)} style={{ padding:"12px 16px", borderRadius:9, cursor:"pointer", background:active?T.accentLight:T.surface, border:`1px solid ${active?T.accent:T.border}`, transition:"all 0.15s" }}>
            <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontStyle:"italic", color:active?T.accentDark:T.ink }}>{t}</div>
            <div style={{ fontSize:11.5, color:T.inkFaint, marginTop:2 }}>{count} patients</div>
          </div>
        );})}
      </div>
      {sel && (
        <div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px 18px", marginBottom:14 }}>
            <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontStyle:"italic", color:T.accentDark, marginBottom:12 }}>{sel}</div>
            <div style={{ display:"flex", gap:28, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:10, color:T.inkFaint, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Source Code Pro',monospace", marginBottom:5 }}>By condition</div>
                {Object.entries(byCond).map(([k,v]) => <div key={k} style={{ display:"flex", gap:10, fontSize:13, color:T.inkSoft, marginBottom:2 }}><span>{k}</span><strong style={{color:T.ink}}>{v}</strong></div>)}
              </div>
              <div>
                <div style={{ fontSize:10, color:T.inkFaint, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Source Code Pro',monospace", marginBottom:5 }}>By side</div>
                {Object.entries(bySide).map(([k,v]) => <div key={k} style={{ display:"flex", gap:10, fontSize:13, color:T.inkSoft, marginBottom:2 }}><span>{k}</span><strong style={{color:T.ink}}>{v}</strong></div>)}
              </div>
            </div>
          </div>
          {pts.sort((a,b)=>a.num-b.num).map((p) => (
            <div key={p.caseId} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", marginBottom:5, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontFamily:"'Lora',serif", fontSize:15, color:T.ink }}>{p.displayName}</div>
                <div style={{ fontSize:11.5, color:T.inkFaint, marginTop:2 }}>{[p.date,p.dbsSide,p.condition].filter(Boolean).join(" · ")}</div>
              </div>
              <PipelineRow p={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Overview = ({ parsed }) => {
  const {patients,stats,allTargets,byTarget,taskGroupMap,byTask} = parsed;
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:28 }}>
        {[["Patients",stats.patients,<Users size={15}/>],["Task types",stats.tasks,<ListChecks size={15}/>],["DBS targets",stats.targets,<Crosshair size={15}/>],["With RAVE",stats.withRave,<Brain size={15}/>]].map(([lbl,val,icon]) => (
          <div key={lbl} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ color:T.accent }}>{icon}</span>
            <div>
              <div style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:28, color:T.ink, lineHeight:1.1 }}>{val}</div>
              <div style={{ fontSize:10.5, color:T.inkFaint, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Source Code Pro',monospace" }}>{lbl}</div>
            </div>
          </div>
        ))}
      </div>
      <Divider label="DBS targets" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:28 }}>
        {allTargets.map((t) => { const tpts=byTarget[t]??[]; const cc=tpts.reduce((a,p)=>{a[p.condition||"?"]=(a[p.condition||"?"]??0)+1;return a;},{}); return (
          <div key={t} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontFamily:"'Lora',serif", fontSize:20, fontStyle:"italic", color:T.accent }}>{t}</div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:32, color:T.ink, lineHeight:1.1, marginBottom:4 }}>{tpts.length}</div>
            <div style={{ fontSize:11, color:T.inkFaint }}>patients</div>
            <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>{Object.entries(cc).map(([k,v]) => <Tag key={k}>{k}: {v}</Tag>)}</div>
          </div>
        );})}
      </div>
      <Divider label="Pipeline status" />
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden", marginBottom:28 }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Patient","Date","Site","Box","Brains","Loc.","RAVE","Dx"].map((h) => (
                <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontFamily:"'Source Code Pro',monospace", color:T.inkFaint, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patients.map((p,i) => (
              <tr key={p.caseId} style={{ borderBottom:i<patients.length-1?`1px solid ${T.borderSoft}`:"none", background:i%2===0?"transparent":T.surfaceHi }}>
                <td style={{ padding:"7px 12px", fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:13.5, color:T.ink }}>{p.displayName}</td>
                <td style={{ padding:"7px 12px", fontSize:12, color:T.inkSoft }}>{p.date}</td>
                <td style={{ padding:"7px 12px" }}>{p.site?<Tag strong>{p.site}</Tag>:<span style={{color:T.inkFainter}}>—</span>}</td>
                {[p.uploadedBox,p.uploadedBrains,p.localization,p.raveLink,p.diagnosis].map((v,vi) => (
                  <td key={vi} style={{ padding:"7px 12px" }}><StatusPip val={v}/></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Divider label="Task frequency" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
        {Object.entries(taskGroupMap).map(([gk,info]) => { const count=new Set(info.tasks.flatMap((tn)=>(byTask[tn]??[]).map((p)=>p.caseId))).size; return {gk,count}; }).sort((a,b)=>b.count-a.count).map(({gk,count}) => (
          <div key={gk} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 12px" }}>
            <span style={{ fontSize:13, color:T.ink }}>{labelOf(gk)}</span>
            <span style={{ fontSize:11, fontFamily:"'Source Code Pro',monospace", color:T.accentDark, background:T.accentLight, padding:"2px 8px", borderRadius:8 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SideItem = ({ p, active, hasRave, onClick }) => (
  <div onClick={onClick} style={{ padding:"10px 12px", borderRadius:8, cursor:"pointer", marginBottom:4, background:active?T.accentLight:"transparent", border:`1px solid ${active?T.accent:"transparent"}`, borderLeft:`3px solid ${active?T.accent:"transparent"}`, transition:"all 0.15s" }}
    onMouseEnter={(e) => { if(!active) e.currentTarget.style.background=T.accentFaint; }}
    onMouseLeave={(e) => { if(!active) e.currentTarget.style.background="transparent"; }}
  >
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <span style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:15.5, color:active?T.accentDark:T.ink }}>{p.displayName}</span>
      {hasRave&&<span style={{ fontSize:9, background:T.okBg, color:T.ok, padding:"1px 5px", borderRadius:3, fontFamily:"'Source Code Pro',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>RAVE</span>}
    </div>
    <div style={{ fontSize:11.5, color:T.inkFaint, marginTop:3 }}>{p.date}{p.site?` · ${p.site}`:""}{p.dbsSide?` · ${p.dbsSide}`:""}</div>
  </div>
);

const HBtn = ({ icon, label, onClick, children }) => (
  <div onClick={onClick} style={{ position:"relative", display:"flex", alignItems:"center", gap:6, padding:"6px 14px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, cursor:"pointer", color:T.inkSoft, fontSize:13, fontWeight:400, userSelect:"none", transition:"all 0.15s", whiteSpace:"nowrap" }}
    onMouseEnter={(e) => { e.currentTarget.style.background=T.accentLight; e.currentTarget.style.color=T.accentDark; e.currentTarget.style.borderColor=T.accent; }}
    onMouseLeave={(e) => { e.currentTarget.style.background=T.surface; e.currentTarget.style.color=T.inkSoft; e.currentTarget.style.borderColor=T.border; }}
  >{icon} {label}{children}</div>
);

const Empty = ({ onLoad, onFolder }) => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:440, gap:20, textAlign:"center" }}>
    <Brain size={44} color={T.inkFainter} strokeWidth={1} />
    <div>
      <div style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:28, color:T.ink, marginBottom:8 }}>Load Precision Data</div>
      <div style={{ fontSize:14, color:T.inkFaint, maxWidth:400, lineHeight:1.7 }}>Load the patient control workbook and optionally link your RAVE folder to begin.</div>
    </div>
    <div style={{ display:"flex", gap:10 }}>
      <label style={{ display:"flex", alignItems:"center", gap:7, position:"relative", padding:"9px 18px", background:T.accent, color:"#fff", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:500 }}>
        <FileSpreadsheet size={14}/> Load workbook
        <input type="file" accept=".xlsx,.xls" style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer" }} onChange={(e)=>{const f=e.target.files?.[0];if(f)onLoad(f);}}/>
      </label>
      <button onClick={onFolder} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", background:T.surface, color:T.inkSoft, border:`1px solid ${T.border}`, borderRadius:7, cursor:"pointer", fontSize:13 }}>
        <FolderOpen size={14}/> Link RAVE folder
      </button>
    </div>
  </div>
);

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function PatientRaveGui() {
  const [parsed,    setParsed]    = useState<any>(null);
  const [xlsxName,  setXlsxName]  = useState("");
  const [raveBlobs, setRaveBlobs] = useState({});
  const [selId,     setSelId]     = useState<string|null>(null);
  const [search,    setSearch]    = useState("");
  const [sortBy,    setSortBy]    = useState("num-asc");
  const [tab,       setTab]       = useState("patients");
  const [error,     setError]     = useState("");
  const [raveUrl,   setRaveUrl]   = useState("");
  const contentRef = useRef(null);

  const loadWb = useCallback(async (file) => {
    try {
      setError("");
      const p = parseWb(await file.arrayBuffer());
      setParsed(p); setXlsxName(file.name);
      if (p.patients[0]) setSelId(p.patients[0].caseId);
    } catch (e) { setError(e?.message ?? "Could not parse workbook."); }
  }, []);

  useEffect(() => {
    fetch(`${BASE}/patient_control_sheet.xlsx`)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const p = parseWb(buf);
        setParsed(p); setXlsxName("patient_control_sheet.xlsx");
        if (p.patients[0]) setSelId(p.patients[0].caseId);
      })
      .catch(() => {});
  }, []);

  const [raveDir, setRaveDir] = useState<any>(null);

  const linkFolder = useCallback(async () => {
    if (!("showDirectoryPicker" in window)) { alert("Folder linking requires Chrome or Edge."); return; }
    try { const h = await (window as any).showDirectoryPicker({ mode:"read" }); setRaveDir(h); }
    catch (e: any) { if (e.name!=="AbortError") console.error(e); }
  }, []);

  const loadManual = useCallback((label, file) => {
    const url = URL.createObjectURL(file);
    setRaveBlobs((prev) => ({ ...prev, [inferRave(label)]: url }));
  }, []);

  useEffect(() => {
    if (!parsed||!selId) { setRaveUrl(""); return; }
    const p = parsed.patientMap[selId];
    if (!p||!p.raveName) { setRaveUrl(""); return; }
    if (raveBlobs[p.raveName]) { setRaveUrl(raveBlobs[p.raveName]); return; }
    if (raveDir) {
      (async () => {
        try {
          const fh = await raveDir.getFileHandle(p.raveName).catch(async () => {
            const m = p.raveName.match(/^([A-Za-z]+)(\d{3})\.html$/);
            if (m) return raveDir.getFileHandle(`${m[1]}${parseInt(m[2])}.html`);
            throw new Error("not found");
          });
          const url = URL.createObjectURL(await fh.getFile());
          setRaveBlobs((prev) => ({ ...prev, [p.raveName]: url }));
          setRaveUrl(url);
        } catch { setRaveUrl(""); }
      })();
      return;
    }
    setRaveUrl("");
  }, [selId, parsed, raveBlobs, raveDir]);

  const patientList = useMemo(() => {
    if (!parsed) return [];
    const q = search.toLowerCase();
    return parsed.patients
      .filter((p) => !q||[p.caseId,p.label,p.condition,p.site].join(" ").toLowerCase().includes(q))
      .sort((a,b) => sortBy==="num-desc"?b.num-a.num:sortBy==="date-desc"?(b.dateRaw>a.dateRaw?1:-1):a.num-b.num);
  }, [parsed, search, sortBy]);

  const cur = parsed?.patientMap[selId] ?? null;

  const TABS = [
    {key:"patients", label:"Patients",    icon:<Users size={13}/>},
    {key:"tasks",    label:"Tasks",       icon:<ListChecks size={13}/>},
    {key:"targets",  label:"DBS Targets", icon:<Crosshair size={13}/>},
    {key:"overview", label:"Overview",    icon:<BarChart3 size={13}/>},
  ];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.ink, fontFamily:"'Source Sans 3',sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{css}</style>

      <header style={{ position:"sticky", top:0, zIndex:50, background:"rgba(253,248,242,0.95)", backdropFilter:"blur(10px)", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 22px", height:56, gap:24, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:10, flexShrink:0 }}>
          <span style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:20, color:T.ink }}>Precision Viewer</span>
          <span style={{ fontSize:10, color:T.inkFainter, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Source Code Pro',monospace" }}>Cajigas Lab</span>
        </div>
        <nav style={{ display:"flex", gap:2, flex:1, justifyContent:"center" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={()=>setTab(t.key)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:6, border:"none", background:tab===t.key?T.accentLight:"transparent", color:tab===t.key?T.accentDark:T.inkSoft, cursor:"pointer", fontSize:13, fontWeight:tab===t.key?500:400, fontFamily:"inherit", transition:"all 0.15s", borderBottom:`2px solid ${tab===t.key?T.accent:"transparent"}` }}
              onMouseEnter={(e)=>{if(tab!==t.key)e.currentTarget.style.color=T.ink;}}
              onMouseLeave={(e)=>{if(tab!==t.key)e.currentTarget.style.color=T.inkSoft;}}
            >{t.icon} {t.label}</button>
          ))}
        </nav>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {parsed&&<span style={{ fontSize:11, color:T.inkFaint, fontFamily:"'Source Code Pro',monospace", padding:"3px 9px", background:T.surfaceHi, borderRadius:4, border:`1px solid ${T.border}` }}>{xlsxName}</span>}
          {raveDir&&<span style={{ fontSize:11, color:T.ok, fontFamily:"'Source Code Pro',monospace", padding:"3px 9px", background:T.okBg, borderRadius:4 }}>● {raveDir.name}</span>}
          <HBtn icon={<FileSpreadsheet size={13}/>} label="Load workbook">
            <input type="file" accept=".xlsx,.xls" style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer" }} onChange={(e)=>{const f=e.target.files?.[0];if(f)loadWb(f);}}/>
          </HBtn>
          <HBtn icon={<FolderOpen size={13}/>} label="Link RAVE folder" onClick={linkFolder}>{null}</HBtn>
        </div>
      </header>

      {error && <div style={{ background:T.badBg, border:`1px solid #d8c0b8`, color:T.bad, padding:"9px 22px", fontSize:13, display:"flex", alignItems:"center", gap:6 }}><AlertCircle size={13}/> {error}</div>}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {tab==="patients" && (
          <aside style={{ width:T.sideW, flexShrink:0, borderRight:`1px solid ${T.border}`, background:T.surface, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px 12px 8px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:15, color:T.ink }}>All Patients</span>
                <span style={{ fontSize:10.5, fontFamily:"'Source Code Pro',monospace", color:T.accentDark, background:T.accentLight, padding:"1px 7px", borderRadius:8 }}>{patientList.length}</span>
              </div>
              <div style={{ position:"relative" }}>
                <Search size={11} color={T.inkFaint} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)" }}/>
                <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search…" style={{ width:"100%", padding:"7px 8px 7px 27px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, color:T.ink, fontSize:12.5, fontFamily:"inherit" }}/>
              </div>
              <select value={sortBy} onChange={(e)=>setSortBy(e.target.value)} style={{ marginTop:7, width:"100%", padding:"6px 8px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, color:T.inkSoft, fontSize:12, fontFamily:"inherit", cursor:"pointer" }}>
                <option value="num-asc">Precision (asc)</option>
                <option value="num-desc">Precision (desc)</option>
                <option value="date-desc">Most recent</option>
              </select>
            </div>
            {!parsed ? (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:20, textAlign:"center" }}>
                <div style={{ color:T.inkFaint, fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:14 }}>Load a workbook to begin</div>
              </div>
            ) : (
              <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
                {patientList.map((p) => (
                  <SideItem key={p.caseId} p={p} active={selId===p.caseId} hasRave={!!raveBlobs[p.raveName]}
                    onClick={() => { setSelId(p.caseId); contentRef.current?.scrollTo({top:0,behavior:"smooth"}); }}/>
                ))}
              </div>
            )}
          </aside>
        )}

        <main ref={contentRef} style={{ flex:1, overflowY:"auto", padding:"28px 32px", background:T.bg }}>
          {tab==="patients"&&!parsed&&<Empty onLoad={loadWb} onFolder={linkFolder}/>}
          {tab==="patients"&&parsed&&!cur&&<div style={{ color:T.inkFainter, textAlign:"center", marginTop:80, fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:18 }}>Select a patient from the sidebar</div>}
          {tab==="patients"&&cur&&(
            <div style={{ maxWidth:1060 }}>
              <Divider label="Summary"/>
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"22px 26px", marginBottom:28 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:18 }}>
                  <div>
                    <div style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontSize:38, color:T.ink, lineHeight:1, letterSpacing:"-0.01em" }}>{cur.displayName}</div>
                    <div style={{ fontSize:12, color:T.inkFaint, marginTop:4, fontFamily:"'Source Code Pro',monospace" }}>{cur.caseId} · {cur.ecog||"—"}</div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"flex-start" }}>
                    {cur.site&&<Tag strong>{cur.site}</Tag>}
                    {cur.condition&&<Tag>{cur.condition}</Tag>}
                    {cur.dbsSide&&<Tag>{cur.dbsSide} side</Tag>}
                    {raveUrl&&<Tag>✓ RAVE</Tag>}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", borderRadius:8, overflow:"hidden", border:`1px solid ${T.border}`, marginBottom:16 }}>
                  {[["Date",cur.date],["Target",cur.site],["Side",cur.dbsSide],["Condition",cur.condition],["MER",cur.mer],["RAVE file",cur.raveName]].map(([lbl,val]) => (
                    <div key={lbl} style={{ background:T.surfaceHi, padding:"10px 13px", borderRight:`1px solid ${T.border}` }}>
                      <div style={{ fontSize:9, color:T.inkFainter, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Source Code Pro',monospace", marginBottom:4 }}>{lbl}</div>
                      <div style={{ fontSize:lbl==="RAVE file"?10.5:13, fontWeight:500, color:val?T.ink:T.inkFainter, fontFamily:lbl==="RAVE file"?"'Source Code Pro',monospace":"inherit" }}>{val||"—"}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:9, color:T.inkFainter, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Source Code Pro',monospace", marginBottom:7 }}>Pipeline status</div>
                  <PipelineRow p={cur}/>
                </div>
              </div>

              <Divider label="Reconstruction"/>
              <div style={{ marginBottom:28 }}><RaveViewer patient={cur} raveUrl={raveUrl} onManualLoad={(f)=>loadManual(cur.label,f)}/></div>

              <Divider label={`Tasks  (${cur.taskRows.length})`}/>
              <div style={{ marginBottom:28 }}><PatientTasks patient={cur}/></div>

              <Divider label="Metadata"/>
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px 20px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 32px" }}>
                {[["Case ID",cur.caseId],["ECOG array",cur.ecog],["Condition",cur.condition],["Diagnosis",cur.diagnosis],["MER",cur.mer],["Localization",cur.localization],["Uploaded to Box",cur.uploadedBox],["Uploaded to Brains",cur.uploadedBrains]].map(([lbl,val]) => (
                  <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.borderSoft}` }}>
                    <span style={{ fontSize:11.5, color:T.inkFaint, fontFamily:"'Source Code Pro',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>{lbl}</span>
                    <span style={{ fontSize:13, color:val?T.ink:T.inkFainter }}>{val||"—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==="tasks"&&<div style={{maxWidth:1060}}><Divider label="Tasks"/>{!parsed?<Empty onLoad={loadWb} onFolder={linkFolder}/>:<TasksBrowse parsed={parsed}/>}</div>}
          {tab==="targets"&&<div style={{maxWidth:1060}}><Divider label="DBS Targets"/>{!parsed?<Empty onLoad={loadWb} onFolder={linkFolder}/>:<TargetsBrowse parsed={parsed}/>}</div>}
          {tab==="overview"&&<div style={{maxWidth:1060}}><Divider label="Overview"/>{!parsed?<Empty onLoad={loadWb} onFolder={linkFolder}/>:<Overview parsed={parsed}/>}</div>}
        </main>
      </div>
    </div>
  );
}