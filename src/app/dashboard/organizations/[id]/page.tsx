"use client";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Building2, Grip, Pencil, Trash2, Sparkles, Target, Briefcase, Coins, MessageSquare, Users, Tag, Globe, MapPin } from "lucide-react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect } from "react";
import { Header } from "@/components/chrome";
import { useDetailMeetings } from "@/components/crm/detail-meetings";
import { MeetingsTable } from "@/components/crm/meetings-table";
import { EventDrawer } from "@/components/event-drawer";
import { getNextQuarterSlot } from "@/lib/datetime-proto";

const tabs = ["Overview","Details","Subsidiaries & Sites","Contacts","Opportunities","Jobs","Placements","Files","Meetings","Notes","Tasks","Activity"];

export default function OrganizationDetailPage(){
  const params=useParams<{id:string}>(); const router=useRouter(); const id=params.id as string;
  const isMbouf = id==="mbouf-testing" || id==="fcc33de4-c3e3-474a-91a6-57509975d30a";
  const name = isMbouf ? "Mbouf TESTING" : `Organization ${id.slice(0,8)}`;
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
  const [meetings, addMeetings]=(useDetailMeetings as any)("organization", id);
  const [scheduleOpen,setScheduleOpen]=useState(false); const [scheduleSlot,setScheduleSlot]=useState({date:"2026-08-05", hour:18, minute:0}); const [toast,setToast]=useState("");
  const handleSchedule=()=>{ setScheduleSlot(getNextQuarterSlot()); setScheduleOpen(true); };
  const handleCreate=(title:string, occ:any, meta?:any)=>{ addMeetings(title,occ,meta); setScheduleOpen(false); setActiveTab("Meetings"); setToast("Meeting scheduled"); setTimeout(()=>setToast(""),2200); };
  return <>
    <Header kicker={<><span className="kicker-muted">Organizations / </span>{name}</>} />
    <main className="contact-detail-page" style={{background:"#f8fafc", minHeight:"100vh"}}>
      <div className="contact-detail-topbar">
        <button className="contact-back-button" onClick={()=>router.back()}><ChevronLeft size={16}/> Back</button>
        <div style={{marginLeft:"auto", display:"inline-flex", gap:8}}>
          <button style={{display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", border:"1px solid #e2e8f0", background:"#fff", borderRadius:8, fontSize:13}}>More <ChevronDown size={14}/></button>
          <button style={{display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", border:"1px solid #0f766e", color:"#0f766e", background:"#fff", borderRadius:8, fontSize:13, fontWeight:600}}><Plus size={14}/> Add Contact</button>
        </div>
      </div>
      <div className="contact-detail-main-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 20px"}}>
        <div style={{display:"flex", alignItems:"flex-start", gap:16}}>
          <span style={{width:56,height:56,borderRadius:"50%", background:"#0f766e", color:"#fff", display:"grid", placeItems:"center", fontSize:18, fontWeight:700}}>MT</span>
          <div style={{flex:1}}>
            <div style={{display:"inline-flex", alignItems:"center", gap:6, color:"#64748b", fontSize:12}}><MapPin size={12} style={{color:"#64748b"}} /> philippines</div>
            <div style={{fontSize:16, fontWeight:600, color:"#1e293b"}}>{name}</div>
          </div>
          <div style={{display:"inline-flex", gap:8, alignItems:"center"}}>
            <span style={{border:"1px solid #e2e8f0", borderRadius:999, padding:"3px 10px", fontSize:12, background:"#f8fafc", display:"inline-flex", gap:6}}><Building2 size={12}/> Holding</span>
            <span style={{border:"1px solid #3b82f6", borderRadius:999, padding:"3px 10px", fontSize:12, color:"#2563eb", background:"#eff6ff", display:"inline-flex", gap:4}}>Lead <ChevronDown size={12}/></span>
          </div>
          <div style={{width:1, height:56, background:"#e2e8f0"}}/>
          <div style={{display:"grid", gap:6, fontSize:12, color:"#475569", minWidth:220}}>
            <div style={{display:"flex", gap:12}}><span style={{width:90, color:"#64748b", display:"inline-flex", gap:6}}><Building2 size={12}/> Industry</span> management consulting</div>
            <div style={{display:"flex", gap:12}}><span style={{width:90, color:"#64748b", display:"inline-flex", gap:6}}><Users size={12}/> Size</span> —</div>
            <div style={{display:"flex", gap:12}}><span style={{width:90, color:"#64748b", display:"inline-flex", gap:6}}><Tag size={12}/> VAT</span> —</div>
            <div style={{display:"flex", gap:12}}><span style={{width:90, color:"#64748b", display:"inline-flex", gap:6}}><Pencil size={12}/> Added By</span> Axelle Bastin</div>
          </div>
          <div style={{width:1, height:56, background:"#e2e8f0"}}/>
          <div style={{minWidth:160}}>
            <div style={{fontSize:12, fontWeight:600, color:"#334155"}}>Contact Information</div>
            <div style={{marginTop:8, display:"inline-flex", gap:6}}>
              <span style={{width:28,height:28,border:"1px solid #e2e8f0", borderRadius:6, display:"grid", placeItems:"center", background:"#fff", color:"#0a66c2", fontWeight:700, fontSize:12}}>in</span>
              <span style={{width:28,height:28,border:"1px solid #e2e8f0", borderRadius:6, display:"grid", placeItems:"center", background:"#fff", color:"#0f766e"}}><Globe size={14}/></span>
            </div>
          </div>
        </div>
        <div className="contact-detail-tabs" role="tablist" style={{marginTop:16, borderTop:"1px solid #f1f5f9", paddingTop:8, display:"flex", gap:16, flexWrap:"wrap"}}>
          {tabs.map((tab)=> {
            const clickable = tab==="Overview"||tab==="Meetings";
            return <button key={tab} role="tab" aria-selected={tab===activeTab} className={tab===activeTab?"active":""} onClick={()=>{ if(clickable) setActiveTab(tab);}} style={!clickable?{opacity:.55, cursor:"default"}:undefined}>{tab}{tab==="Meetings" && <span className="detail-tab-new-badge">NEW</span>}</button>;
          })}
        </div>
      </div>
      {activeTab==="Meetings" ? <MeetingsTable filterEntity="organization" filterId={id} filterName={name} extraMeetings={meetings} onScheduleMeeting={handleSchedule} /> : (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span className="contact-card-title" style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Contacts <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>3</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∧</button></div></header>
            <div style={{padding:12, display:"grid", gap:8}}>
              {[
                {initials:"BC", name:"Boufous Contact", role:"manager", color:"#0f766e"},
                {initials:"MC", name:"mbouf Contact", role:"manager", color:"#4f46e5"},
                {initials:"HT", name:"Hassan Taleb", role:"Owner", color:"#4f46e5"},
              ].map(c=> (
                <div key={c.name} style={{display:"flex", alignItems:"center", gap:10, background:"#f8fafc", border:"1px solid #f1f5f9", borderRadius:8, padding:"8px 10px"}}>
                  <span style={{width:28,height:28, borderRadius:6, background:c.color, color:"#fff", display:"grid", placeItems:"center", fontSize:11, fontWeight:700}}>{c.initials}</span>
                  <div style={{flex:1}}><div style={{fontSize:13, fontWeight:600, color:"#1e293b"}}>{c.name}</div><div style={{fontSize:11, color:"#64748b"}}>{c.role}</div></div>
                  <span style={{display:"inline-flex", gap:6, color:"#94a3b8"}}><Pencil size={14}/><Trash2 size={14} style={{color:"#ef4444"}}/></span>
                </div>
              ))}
            </div>
            <footer style={{padding:10, display:"flex", justifyContent:"flex-end"}}><button style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12}}>View all</button></footer>
          </section>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Opportunities <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>1</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∧</button></div></header>
            <div style={{padding:12}}><div style={{display:"flex", alignItems:"center", gap:10, background:"#f8fafc", border:"1px solid #f1f5f9", borderRadius:8, padding:"10px 12px"}}><span style={{width:28,height:28, borderRadius:6, background:"#f1f5f9", display:"grid", placeItems:"center"}}><Target size={14} style={{color:"#0f766e"}}/></span> test</div></div>
            <footer style={{padding:10, display:"flex", justifyContent:"flex-end"}}><button style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12}}>View all</button></footer>
          </section>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Jobs <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>1</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∧</button></div></header>
            <div style={{padding:12}}><div style={{display:"flex", alignItems:"center", gap:10, background:"#f8fafc", border:"1px solid #f1f5f9", borderRadius:8, padding:"10px 12px"}}><span style={{width:28,height:28, borderRadius:6, background:"#f1f5f9", display:"grid", placeItems:"center"}}><Briefcase size={14} style={{color:"#0f766e"}}/></span><div style={{flex:1}}><div style={{fontSize:13, fontWeight:600}}>UX/UI designer (mbouf TESTING)</div><div style={{fontSize:11, color:"#64748b"}}>Permanent</div></div><span style={{border:"1px solid #0f766e", color:"#0f766e", borderRadius:999, padding:"2px 8px", fontSize:11}}>Opened</span></div></div>
            <footer style={{padding:10, display:"flex", justifyContent:"flex-end"}}><button style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12}}>View all</button></footer>
          </section>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Placements <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>1</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∨</button></div></header>
            <div style={{padding:24, color:"#94a3b8", textAlign:"center", fontSize:12}}>—</div>
          </section>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Notes <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>0</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∨</button></div></header>
            <div style={{padding:24, color:"#94a3b8", textAlign:"center", fontSize:12}}>No notes yet</div>
          </section>
          <section className="contact-detail-card" style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden"}}>
            <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #f1f5f9"}}><span style={{display:"inline-flex", gap:6, fontWeight:600}}><Grip size={14}/> Tasks <i style={{background:"#f1f5f9", borderRadius:999, padding:"1px 6px", fontSize:11}}>0</i></span><div style={{display:"inline-flex", gap:6}}><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}><Plus size={14}/></button><button style={{width:28,height:28, border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", display:"grid", placeItems:"center"}}>∨</button></div></header>
            <div style={{padding:24, color:"#94a3b8", textAlign:"center", fontSize:12}}>No tasks</div>
          </section>
        </div>
      )}
      <EventDrawer open={scheduleOpen} onClose={()=>setScheduleOpen(false)} slot={scheduleSlot} onCreate={handleCreate} initialLinkedRecords={[{type:"Organization" as const, item:{id, name, initials: name.slice(0,2).toUpperCase(), color:"#0f766e"}}]} fixedEventType="Meeting" allowedEventTypes={["Meeting","Client meeting","Interview","Candidate meeting","Other"]}/>
      <div className={`toast ${toast?"shown":""}`}>{toast}</div>
    </main>
  </>;
}
