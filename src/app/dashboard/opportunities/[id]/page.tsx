"use client";
import { ChevronDown, ChevronLeft, Plus, Grip, Users, Coins, CalendarDays, Pencil, Building2, MapPin, Briefcase, Trash2 } from "lucide-react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect } from "react";
import { Header } from "@/components/chrome";
import { useDetailMeetings } from "@/components/crm/detail-meetings";
import { MeetingsTable } from "@/components/crm/meetings-table";
import { EventDrawer } from "@/components/event-drawer";
import { getNextQuarterSlot } from "@/lib/datetime-proto";

const tabs=["Overview","Details","Contacts","Submitted candidates","Files","Meetings","Notes","Tasks","Activity"];

export default function OpportunityDetailPage(){
  const params=useParams<{id:string}>(); const router=useRouter(); const id=params.id as string;
  const isRnd = id==="10000073" || id==="r&d chimistry" || id==="frontend" || id==="R&D Chimistry";
  const name = isRnd ? "R&D Chimistry" : `Opportunity ${id}`;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialTab = searchParams.get("tab") === "meetings" ? "Meetings" : "Overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    const desiredTab = activeTab === "Meetings" ? "meetings" : null;
    if (currentTab === desiredTab) return;
    const params = new URLSearchParams(searchParams.toString());
    if (desiredTab) params.set("tab", desiredTab);
    else params.delete("tab");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false } as any);
  }, [activeTab, pathname, router, searchParams]);
  const [meetings, addMeetings]=(useDetailMeetings as any)("opportunity", id);
  const [scheduleOpen,setScheduleOpen]=useState(false); const [scheduleSlot,setScheduleSlot]=useState({date:"2026-08-05", hour:18, minute:0}); const [toast,setToast]=useState("");
  const handleSchedule=()=>{ setScheduleSlot(getNextQuarterSlot()); setScheduleOpen(true); };
  const handleCreate=(title:string, occ:any, meta?:any)=>{ addMeetings(title,occ,meta); setScheduleOpen(false); setActiveTab("Meetings"); setToast("Meeting scheduled"); setTimeout(()=>setToast(""),2200); };

  return <>
    <Header kicker={<><span className="kicker-muted">Opportunities / </span><span style={{color:"#0f766e"}}>{name.toLowerCase()}</span></>} />
    <main className="contact-detail-page" style={{background:"#f8fafc", minHeight:"100vh"}}>
      <div className="contact-detail-topbar">
        <button className="contact-back-button" onClick={()=>router.back()}><ChevronLeft size={16}/> Back</button>
        <div style={{marginLeft:"auto", display:"inline-flex", gap:8}}>
          <button style={{display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", border:"1px solid #0f766e", color:"#0f766e", background:"#fff", borderRadius:8, fontSize:13, fontWeight:600}}>Add Note <ChevronDown size={14}/></button>
        </div>
      </div>
      <div className="contact-detail-main-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 20px"}}>
        <div style={{display:"flex", gap:24}}>
          <div style={{flex:1}}>
            <div style={{display:"inline-flex", alignItems:"center", gap:6, fontSize:11, color:"#475569", border:"1px solid #e2e8f0", borderRadius:6, padding:"2px 8px", background:"#f8fafc"}}><span style={{width:14,height:14, background:"#e11d48", color:"#fff", display:"grid", placeItems:"center", borderRadius:3, fontSize:8}}>B</span> Bosmans <span style={{color:"#94a3b8"}}>·</span> Subsidiary</div>
            <div style={{fontSize:16, fontWeight:600, color:"#1e293b", marginTop:8}}>{name}</div>
            <div style={{fontSize:12, color:"#64748b", marginTop:4, borderTop:"1px solid #f1f5f9", paddingTop:8}}>r&amp;d chimistry</div>
          </div>
          <div style={{width:1, background:"#e2e8f0"}}/>
          <div style={{flex:1, display:"grid", gap:6, fontSize:12, color:"#475569"}}>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><Users size={12}/> Est. Number of positions</span> 8</div>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><Coins size={12}/> Est. Fee Value</span> 379 392 $</div>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><CalendarDays size={12}/> Est. Close Date</span> 17/08/2026</div>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><Pencil size={12}/> Added By</span> Axelle Bastin</div>
          </div>
          <div style={{width:1, background:"#e2e8f0"}}/>
          <div style={{flex:1, display:"grid", gap:6, fontSize:12, color:"#475569"}}>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><Building2 size={12}/> Function</span> Finance</div>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><MapPin size={12}/> Location</span> —</div>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><Briefcase size={12}/> Employment type</span> Remote</div>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{color:"#64748b", display:"inline-flex", gap:6}}><Briefcase size={12}/> Job Type</span> Temporary</div>
          </div>
        </div>
        <div className="contact-detail-tabs" role="tablist" style={{marginTop:16, borderTop:"1px solid #f1f5f9", paddingTop:8, display:"flex", gap:16}}>
          {tabs.map(tab=> {
            const clickable = tab==="Overview"||tab==="Meetings";
            return <button key={tab} role="tab" aria-selected={tab===activeTab} className={tab===activeTab?"active":""} onClick={()=>{ if(clickable) setActiveTab(tab);}} style={!clickable?{opacity:.55,cursor:"default"}:undefined}>{tab}{tab==="Meetings" && <span className="detail-tab-new-badge">NEW</span>}</button>;
          })}
        </div>
      </div>
      {activeTab==="Meetings" ? <MeetingsTable filterEntity="opportunity" filterId={id} filterName={name} extraMeetings={meetings} onScheduleMeeting={handleSchedule} /> : (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Contacts <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>2</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∧</button></div></header>
            <div style={{padding:12, display:"grid", gap:8}}>
              <div style={{display:"flex", alignItems:"center", gap:10, background:"#f8fafc", border:"1px solid #f1f5f9", borderRadius:8, padding:"10px 12px"}}><span style={{width:28,height:28, borderRadius:6, background:"#f59e0b", color:"#fff", display:"grid", placeItems:"center", fontSize:11, fontWeight:700}}>HT</span> Hassan Taleb <Trash2 size={14} style={{color:"#ef4444", marginLeft:"auto"}} /></div>
              <div style={{display:"flex", alignItems:"center", gap:10, background:"#f8fafc", border:"1px solid #f1f5f9", borderRadius:8, padding:"10px 12px"}}><span style={{width:28,height:28, borderRadius:6, background:"#f59e0b", color:"#fff", display:"grid", placeItems:"center", fontSize:11, fontWeight:700}}>TF</span> Test for <Trash2 size={14} style={{color:"#ef4444", marginLeft:"auto"}} /></div>
            </div>
            <footer style={{padding:10, display:"flex", justifyContent:"flex-end"}}><button style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12}}>View all</button></footer>
          </section>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Files <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>0</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∧</button></div></header>
            <div style={{padding:32, textAlign:"center", display:"grid", placeItems:"center", gap:8}}>
              <img src="https://front.develop.hme.ovh/static/media/empty-state-note.46815edd.svg" alt="no files" width={80} height={80} style={{opacity:.9}}/>
              <strong style={{fontSize:14, color:"#1e293b"}}>No files yet</strong>
              <span style={{fontSize:12, color:"#64748b"}}>Files uploaded to this opportunity will appear<br/>here.</span>
            </div>
            <footer style={{padding:10, display:"flex", justifyContent:"flex-end", borderTop:"1px solid #f1f5f9"}}><button style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12}}>View all</button></footer>
          </section>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden", gridColumn:"2"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Notes <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>0</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∧</button></div></header>
            <div style={{padding:32, textAlign:"center", display:"grid", placeItems:"center", gap:8}}>
              <img src="https://front.develop.hme.ovh/static/media/empty-state-note.46815edd.svg" alt="no notes" width={80} height={80} style={{opacity:.9}}/>
              <strong style={{fontSize:14, color:"#1e293b"}}>No notes yet</strong>
              <span style={{fontSize:12, color:"#64748b"}}>Notes left on this record will appear here.</span>
            </div>
          </section>
        </div>
      )}
      <EventDrawer open={scheduleOpen} onClose={()=>setScheduleOpen(false)} slot={scheduleSlot} onCreate={handleCreate} initialLinkedRecords={[{type:"Opportunity" as const, item:{id, title:name, name}}]} fixedEventType="Meeting" allowedEventTypes={["Meeting","Client meeting","Interview","Candidate meeting","Other"]}/>
      <div className={`toast ${toast?"shown":""}`}>{toast}</div>
    </main>
  </>;
}
