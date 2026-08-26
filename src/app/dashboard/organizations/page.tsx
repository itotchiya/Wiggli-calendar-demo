"use client";
import { ChevronDown, ChevronRight, Columns3, Plus, Search, Download, ListFilter, MoreHorizontal, Globe, Building2 } from "lucide-react"
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/chrome";

type OrgRow = { id: string; name: string; initials: string; color: string; status: "Lead"|"Client"|"Prospect"; level: "Holding"|"Subsidiary"; website?: string; industry?: string; email?: string; isSubsidiaryOf?: string; };

const orgs: OrgRow[] = [
  { id: "humans-1", name: "Humans hive", initials:"HH", color:"#84cc16", status:"Lead", level:"Holding", industry:"information technology and services" },
  { id: "mbouf-testing", name: "Mbouf TESTING", initials:"MT", color:"#0f766e", status:"Lead", level:"Holding", website:"https://ecxbusinesssoluti...", industry:"management consulting" },
  { id: "test-test", name: "Test test", initials:"TT", color:"#4f46e5", status:"Lead", level:"Subsidiary", industry:"think tanks", isSubsidiaryOf:"mbouf-testing" },
  { id: "ecx-1", name: "Ecx business solutions", initials:"EB", color:"#4f46e5", status:"Lead", level:"Holding", website:"https://ecxbusinesssoluti...", industry:"management consulting" },
  { id: "haifeng", name: "Haifeng cable co., ltd.", initials:"HC", color:"#0f766e", status:"Lead", level:"Holding", industry:"building materials" },
  { id: "humans-2", name: "Humans hive", initials:"HH", color:"#84cc16", status:"Lead", level:"Holding", industry:"information technology and services" },
  { id: "hello-corp", name: "Hello Corp", initials:"HC", color:"#7c3aed", status:"Lead", level:"Holding" },
  { id: "ecx-2", name: "Ecx business solutions", initials:"EB", color:"#4f46e5", status:"Lead", level:"Holding", website:"https://ecxbusinesssoluti...", industry:"management consulting" },
  { id: "ecx-3", name: "Ecx business solutions", initials:"EB", color:"#4f46e5", status:"Lead", level:"Holding", website:"https://ecxbusinesssoluti...", industry:"management consulting" },
  { id: "hello", name: "Hello", initials:"H", color:"#ea580c", status:"Lead", level:"Holding" },
  { id: "quality", name: "Quality soluções em mobilidade", initials:"QS", color:"#f59e0b", status:"Lead", level:"Holding", website:"https://qualityfrotas.com.br", industry:"outsourcing", email:"test@qualityfrotas.com.br" },
  { id: "cocal", name: "Cocal alimentos", initials:"CA", color:"#22c55e", status:"Client", level:"Holding", website:"https://cocacereais.com.br", industry:"food production", email:"test@cocalcereais.com.br" },
  { id: "dealy", name: "Dealy", initials:"D", color:"#2563eb", status:"Prospect", level:"Holding", website:"https://dealy.biz", industry:"management consulting", email:"consulting@gmail.com" },
  { id: "fcc33de4-c3e3-474a-91a6-57509975d30a", name: "Mbouf TESTING", initials:"MT", color:"#0f766e", status:"Lead", level:"Holding", website:"https://ecxbusinesssoluti...", industry:"management consulting" },
];

function StatusPill({status}:{status:string}) {
  const style:any = status==="Lead" ? {border:"1px solid #3b82f6",color:"#2563eb",background:"#eff6ff"} : status==="Client" ? {border:"1px solid #22c55e",color:"#15803d",background:"#f0fdf4"} : {border:"1px solid #14b8a6",color:"#0f766e",background:"#f0fdfa"};
  return <span style={{...style, padding:"3px 10px", borderRadius:999, fontSize:12, fontWeight:500, display:"inline-flex"}}>{status}</span>;
}

export default function OrganizationsPage(){
  const router=useRouter(); const [page,setPage]=useState(1);
  return <>
    <Header kicker={<>Organizations</>} />
    <main className="jobs-page" style={{background:"#f8fafc", minHeight:"100vh"}}>
      <div className="contacts-title-row">
        <h1>Organizations</h1>
        <div className="contacts-title-actions">
          <button className="contacts-process-button" disabled>Process organizations <ChevronDown size={14}/></button>
          <button className="contacts-add-button" onClick={()=>router.push("/organizations/fcc33de4-c3e3-474a-91a6-57509975d30a")}><Plus size={16}/> Add organization</button>
        </div>
      </div>
      <div className="jobs-toolbar">
        <label className="jobs-search"><input type="text" placeholder="Search in ( organization name, website, industry...)" /><Search size={16} /></label>
        <button className="jobs-filters-button"><ListFilter size={16}/> Filter</button>
        <div className="jobs-toolbar-right"><button className="icon-button" aria-label="Download"><Download size={16} /></button><button className="jobs-columns-button"><Columns3 size={16}/> Columns <ChevronDown size={14}/></button></div>
      </div>
      <div style={{height:16}} aria-hidden="true"/>
      <div className="jobs-table-wrap">
        <table className="jobs-table">
          <thead><tr>
            <th className="jobs-table-menu-col" style={{width:72, minWidth:72, maxWidth:72}}><div style={{display:"flex", alignItems:"center", justifyContent:"center"}}><input type="checkbox" aria-label="Select all" style={{width:16, height:16, accentColor:"#0f766e"}} /></div></th>
            <th><span>Organization Name</span><ChevronDown size={13} /></th>
            <th><span>Status</span><ChevronDown size={13} /></th>
            <th><span>Level</span><ChevronDown size={13} /></th>
            <th><span>Website</span><ChevronDown size={13} /></th>
            <th><span>Industry</span><ChevronDown size={13} /></th>
            <th><span>Linkedin</span><ChevronDown size={13} /></th>
            <th><span>Email</span><ChevronDown size={13} /></th>
          </tr></thead>
          <tbody>
            {orgs.map((o)=> (
              <tr key={o.id} onClick={()=>router.push(`/organizations/${o.id}`)} style={o.isSubsidiaryOf?{background:"#f8fafc"}:undefined}>
                <td className="jobs-table-menu-col" onClick={(e)=>e.stopPropagation()} style={{width:72, minWidth:72, maxWidth:72}}><div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8}}><input type="checkbox" aria-label="Select row" style={{width:16, height:16, accentColor:"#0f766e"}} /><button aria-label="actions" style={{border:0, background:"transparent", cursor:"pointer", color:"var(--muted)", display:"grid", placeItems:"center", padding:2, width:24, height:24}}><MoreHorizontal size={16} /></button></div></td>
                <td>
                  <span style={{display:"inline-flex", alignItems:"center", gap:8}}>
                    {o.isSubsidiaryOf && <span style={{width:24, height:12, borderLeft:"1px solid #cbd5e1", borderBottom:"1px solid #cbd5e1", borderRadius:"0 0 0 6px", marginLeft:8, marginRight:2}}/>}
                    {o.isSubsidiaryOf && <ChevronRight size={12} style={{color:"#94a3b8"}} />}
                    <span style={{width:22, height:22, borderRadius:"50%", background:o.color, color:"#fff", display:"grid", placeItems:"center", fontSize:10, fontWeight:700}}>{o.initials}</span>
                    {o.name}
                  </span>
                </td>
                <td><StatusPill status={o.status}/></td>
                <td><span style={{display:"inline-flex", alignItems:"center", gap:6, border:"1px solid #e2e8f0", background:"#fff", borderRadius:999, padding:"3px 10px", fontSize:12}}><Building2 size={12} /> {o.level}</span></td>
                <td className={o.website ? "" : "jobs-cell-muted"}>{o.website ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><Globe size={12} style={{color:"#0f766e"}}/>{o.website}</span> : "—"}</td>
                <td>{o.industry ? <span style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:6, padding:"2px 8px", fontSize:12}}>{o.industry}</span> : <span style={{color:"#94a3b8"}}>—</span>}</td>
                <td className="jobs-cell-muted">—</td>
                <td className={o.email ? "" : "jobs-cell-muted"}>{o.email ?? "—"}</td>
                
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 4px", color:"#64748b", fontSize:12}}>
        <span>Rows per page <span style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:6, padding:"2px 8px"}}>12 <ChevronDown size={12} style={{display:"inline"}}/></span></span>
        <span style={{display:"inline-flex", alignItems:"center", gap:12}}><span style={{color:"#cbd5e1"}}>‹</span><span style={{color:"#0f766e", borderBottom:"2px solid #0f766e", paddingBottom:2}}>1</span><span>2</span><span>›</span></span>
        <span/>
      </div>
    </main>
  </>;
}
