"use client";
import { ChevronDown, Columns3, Plus, Search, Download, ListFilter, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/chrome";

type Opp = { ref:string; name:string; description:string; org:string; orgId:string; orgChain:string[]; func:string; status:string; date:string; fee:string; };
const opps: Opp[] = [
  {ref:"10000073", name:"R&d chimistry", description:"r&amp;d chimistry", orgChain:["Maes","Bosmans"], org:"Bosmans", orgId:"bosmans", func:"Finance", status:"Testing opp", date:"17/08/2026", fee:"379,392 $"},
  {ref:"10000049", name:"Mbouf testing", description:"test by Mustapha Boufous", orgChain:["Maes","Bosmans"], org:"Bosmans", orgId:"bosmans", func:"—", status:"Test", date:"25/07/2026", fee:"—"},
  {ref:"10000047", name:"Scelerisque senectus sodales ...", description:"isque inceptos nato... See more", orgChain:["Maes","Testing-organization-v7"], org:"Testing-organization-v7", orgId:"testing-v7", func:"Engineering", status:"Testing opp", date:"23/07/2026", fee:"8,640 $"},
  {ref:"10000045", name:"Opportunity for FE developer", description:"Opportunity for FE developer", orgChain:["Maes","Charlier SA"], org:"Charlier SA", orgId:"charlier", func:"—", status:"Qualifying", date:"—", fee:"—"},
  {ref:"10000044", name:"Uuiiuiihhjj", description:"jkkkjkhjkhjk", orgChain:["Maes","Bosmans"], org:"Bosmans", orgId:"bosmans", func:"—", status:"Qualifying", date:"18/07/2026", fee:"—"},
  {ref:"10000043", name:"Opportunity Title", description:"Opportunity Title", orgChain:["Maes","Bosmans"], org:"Bosmans", orgId:"bosmans", func:"—", status:"Special", date:"—", fee:"2,000 $"},
  {ref:"10000037", name:"Test", description:"—", orgChain:["Mbouf TESTING"], org:"Mbouf TESTING", orgId:"mbouf-testing", func:"—", status:"Lead", date:"—", fee:"—"},
  {ref:"10000036", name:"WiDev", description:"—", orgChain:["Maes","Bosmans"], org:"Bosmans", orgId:"bosmans", func:"—", status:"Proposal sent", date:"17/06/2026", fee:"—"},
  {ref:"10000035", name:"Python Developer", description:"Senior Python Developer", orgChain:["Maes","Bosmans","Lacroix Associations"], org:"Lacroix Associations", orgId:"lacroix", func:"—", status:"Proposal sent", date:"—", fee:"—"},
  {ref:"10000017", name:"Data Engineer", description:"Data Engineer", orgChain:["Quality soluções em mobilidade"], org:"Quality soluções em mobilidade", orgId:"quality", func:"Human Resources", status:"Test", date:"31/05/2026", fee:"14,444 $"},
  {ref:"10000009", name:"AI Engineer", description:"looking for an AI Eng... See more", orgChain:["Maes","Charlier SA"], org:"Charlier SA", orgId:"charlier", func:"Finance", status:"Test", date:"31/05/2026", fee:"—"},
  {ref:"10000005", name:"Opp test 2", description:"Description", orgChain:["Maes","Bosmans"], org:"Bosmans", orgId:"bosmans", func:"Human Resources", status:"Proposal sent", date:"31/05/2026", fee:"150,000 $"},
];

function StatusPill({s}:{s:string}){
  const m:any = { "Testing opp":{border:"#f59e0b",color:"#d97706",bg:"#fffbeb"}, "Test":{border:"#3b82f6",color:"#2563eb",bg:"#eff6ff"}, "Qualifying":{border:"#fb923c",color:"#ea580c",bg:"#fff7ed"}, "Special":{border:"#3b82f6",color:"#2563eb",bg:"#eff6ff"}, "Lead":{border:"#06b6d4",color:"#0891b2",bg:"#ecfeff"}, "Proposal sent":{border:"#f59e0b",color:"#d97706",bg:"#fffbeb"} };
  const c=m[s]||{border:"#e2e8f0",color:"#64748b",bg:"#f8fafc"};
  return <span style={{border:`1px solid ${c.border}`, color:c.color, background:c.bg, padding:"3px 10px", borderRadius:999, fontSize:12}}>{s}</span>;
}

export default function OpportunitiesPage(){
  const router=useRouter();
  return <>
    <Header kicker={<>Opportunities</>} />
    <main className="jobs-page" style={{background:"#f8fafc", minHeight:"100vh"}}>
      <div className="contacts-title-row"><h1>Opportunities</h1><div className="contacts-title-actions"><button className="contacts-process-button" disabled>Process Opportunities <ChevronDown size={14}/></button><button className="contacts-add-button"><Plus size={16}/> Add Opportunity</button></div></div>
      <div className="jobs-toolbar">
        <label className="jobs-search"><input type="text" placeholder="Search in (title, name, description...)" /><Search size={16} /></label>
        <button className="jobs-filters-button"><ListFilter size={16}/> Filter</button>
        <div className="jobs-toolbar-right">
          <button className="icon-button" aria-label="Download"><Download size={16} /></button>
          <button className="jobs-columns-button"><Columns3 size={16}/> Columns <ChevronDown size={14}/></button>
        </div>
      </div>
      <div style={{height:16}} aria-hidden="true"/>
      <div className="jobs-table-wrap">
        <table className="jobs-table">
          <thead><tr>
            <th className="jobs-table-menu-col" style={{width:72, minWidth:72, maxWidth:72}}><div style={{display:"flex", alignItems:"center", justifyContent:"center"}}><input type="checkbox" aria-label="Select all" style={{width:16, height:16, accentColor:"#0f766e"}} /></div></th>
            <th><span>Ref</span><ChevronDown size={13} /></th>
            <th><span>Name</span><ChevronDown size={13} /></th>
            <th><span>Description</span><ChevronDown size={13} /></th>
            <th><span>Organization</span><ChevronDown size={13} /></th>
            <th><span>Function</span><ChevronDown size={13} /></th>
            <th><span>Status</span><ChevronDown size={13} /></th>
            <th><span>Est. close date</span><ChevronDown size={13} /></th>
            <th><span>Est. fee value</span><ChevronDown size={13} /></th>
          </tr></thead>
          <tbody>
            {opps.map(o=> (
              <tr key={o.ref} onClick={()=>router.push(`/opportunities/${o.ref}`)} style={{cursor:"pointer"}}>
                <td className="jobs-table-menu-col" onClick={e=>e.stopPropagation()} style={{width:72, minWidth:72, maxWidth:72}}><div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8}}><input type="checkbox" aria-label="Select row" style={{width:16, height:16, accentColor:"#0f766e"}} /><button aria-label="row" style={{border:0, background:"transparent", cursor:"pointer", color:"var(--muted)", display:"grid", placeItems:"center", padding:2, width:24, height:24}}><MoreHorizontal size={16} /></button></div></td>
                <td style={{fontSize:12}}>{o.ref}</td>
                <td style={{fontSize:12, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{o.name}</td>
                <td style={{fontSize:12, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{o.description}</td>
                <td style={{fontSize:12}}>
                  <span style={{display:"inline-flex", alignItems:"center", gap:4, flexWrap:"wrap"}}>
                    {o.orgChain.map((org,i)=> (
                      <span key={org} style={{display:"inline-flex", alignItems:"center", gap:4}}>
                        {i>0 && <span style={{color:"#94a3b8"}}>›</span>}
                        <span style={{width:16,height:16, borderRadius:4, background: org==="Maes"?"#c026d3": org==="Bosmans"?"#e11d48": org==="Charlier SA"?"#e11d48": org==="Testing-organization-v7"?"#2563eb":"#0f766e", color:"#fff", display:"grid", placeItems:"center", fontSize:8, fontWeight:700}}>{org.slice(0,1)}</span>
                        <span style={{color: o.orgChain[o.orgChain.length-1]===org ? "#1e293b" : "#64748b"}}>{org}</span>
                      </span>
                    ))}
                  </span>
                </td>
                <td style={{fontSize:12, color:"#475569"}}>{o.func}</td>
                <td><StatusPill s={o.status}/></td>
                <td style={{fontSize:12}}>{o.date}</td>
                <td style={{fontSize:12}}>{o.fee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 4px", color:"#64748b", fontSize:12}}>
        <span>Rows per page <span style={{border:"1px solid #e2e8f0", background:"#fff", borderRadius:6, padding:"2px 8px"}}>12 <ChevronDown size={12} style={{display:"inline"}}/></span></span>
        <span/>
      </div>
    </main>
  </>;
}
