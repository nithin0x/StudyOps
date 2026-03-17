import { useState, useEffect, useRef } from "react";

// ── TOKYO NIGHT ────────────────────────────────────────────────────────
const TN = {
  bg:"#1a1b26", bgDark:"#16161e", bgDeep:"#13131a", bgPanel:"#1f2335",
  bgPopup:"#24283b", border:"#292e42", border2:"#3b4261",
  fg:"#c0caf5", fgMuted:"#565f89", fgDim:"#3b4261", comment:"#444b6a",
  cyan:"#7dcfff", blue:"#7aa2f7", purple:"#bb9af7", green:"#9ece6a",
  yellow:"#e0af68", orange:"#ff9e64", red:"#f7768e", teal:"#73daca", magenta:"#c678dd",
};

// ── DEFAULTS ───────────────────────────────────────────────────────────
const DEFAULT_PLATFORMS = [
  { key:"htb",  name:"HackTheBox",  color:TN.green,  icon:"⬡", removable:false },
  { key:"thm",  name:"TryHackMe",   color:TN.red,    icon:"◈", removable:false },
  { key:"hs",   name:"HackSmarter", color:TN.cyan,   icon:"◉", removable:false },
];
const PLATFORM_ICONS = ["⬡","◈","◉","◆","◇","▲","△","●","○","◐","◑","✦","★","◎","⊕","⊗"];
const PLATFORM_COLORS = [TN.green,TN.red,TN.cyan,TN.purple,TN.orange,TN.yellow,TN.teal,TN.magenta,TN.blue,"#f0a500","#00d4aa","#e06c75"];

const COURSE_COLORS = [TN.orange,TN.blue,TN.purple,TN.teal,TN.red,TN.yellow,TN.cyan,TN.magenta];

const DIFFICULTIES = [
  {key:"easy",  label:"EASY",  color:TN.green },
  {key:"medium",label:"MED",   color:TN.yellow},
  {key:"hard",  label:"HARD",  color:TN.orange},
  {key:"insane",label:"INSANE",color:TN.red   },
];
const COMP_STATUS = [
  {key:"todo",       label:"TODO",        bg:"transparent", fg:TN.fgMuted},
  {key:"inprogress", label:"IN PROGRESS", bg:"#162030",     fg:TN.cyan   },
  {key:"pwned",      label:"PWNED ✓",     bg:"#162016",     fg:TN.green  },
  {key:"stuck",      label:"STUCK",       bg:"#201616",     fg:TN.red    },
];
const WRITEUP_STATUS = [
  {key:"none",     label:"NO WRITEUP", bg:"transparent", fg:TN.fgMuted},
  {key:"draft",    label:"DRAFT",      bg:"#201e10",     fg:TN.yellow },
  {key:"done",     label:"DONE ✓",     bg:"#162016",     fg:TN.green  },
  {key:"published",label:"PUBLISHED",  bg:"#1a1630",     fg:TN.purple },
];

const uid = () => Math.random().toString(36).slice(2)+Date.now();
const fmtT = s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const ringP = (p,r=58)=>{ const c=2*Math.PI*r; return {strokeDasharray:c,strokeDashoffset:c*(1-p)}; };
const dLeft = d=>{ if(!d) return null; return Math.ceil((new Date(d)-new Date())/86400000); };
const fmtD = d=>{ if(!d) return "—"; return new Date(d+"T00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}); };
const validUrl = s=>{ try{ new URL(s); return true; }catch{ return false; } };

// ── SEED ───────────────────────────────────────────────────────────────
const SEED_COURSES = [
  { id:"co1", name:"Linux Fundamentals", color:TN.teal, provider:"TryHackMe",
    startDate:"2026-01-10", endDate:"2026-02-20", sessions:8,
    sections:[
      {id:"sc1",title:"File System & Navigation",subs:[
        {id:"sb1",title:"Directory structure",done:true},
        {id:"sb2",title:"File permissions",done:true},
        {id:"sb3",title:"grep, find, awk",done:false},
      ]},
      {id:"sc2",title:"Networking Basics",subs:[
        {id:"sb4",title:"TCP/IP model",done:false},
        {id:"sb5",title:"Nmap basics",done:false},
      ]},
    ],
  },
  { id:"co2", name:"Python for Security", color:TN.blue, provider:"Coursera",
    startDate:"2026-02-01", endDate:"2026-04-15", sessions:3,
    sections:[
      {id:"sc3",title:"Scripting Fundamentals",subs:[
        {id:"sb6",title:"Variables & data types",done:false},
        {id:"sb7",title:"File I/O",done:false},
      ]},
    ],
  },
];

const SEED_CERTS = [
  { id:"cr1", name:"AWS Solutions Architect", color:TN.orange, vendor:"Amazon",
    certStart:"2026-02-01", studyStart:"2026-03-01", studyEnd:"2026-05-10", examDate:"2026-05-15",
    sessions:6, passed:false,
    sections:[
      {id:"cs1",title:"IAM & Security",subs:[
        {id:"csb1",title:"Users, Groups & Policies",done:true},
        {id:"csb2",title:"Roles & Trust Policies",done:true},
        {id:"csb3",title:"MFA & Access Keys",done:false},
      ]},
      {id:"cs2",title:"EC2 & Networking",subs:[
        {id:"csb4",title:"Instance Types",done:false},
        {id:"csb5",title:"VPC & Subnets",done:false},
      ]},
    ],
  },
  { id:"cr2", name:"CompTIA Security+", color:TN.purple, vendor:"CompTIA",
    certStart:"2026-04-01", studyStart:"2026-05-20", studyEnd:"2026-07-20", examDate:"2026-07-30",
    sessions:1, passed:false,
    sections:[
      {id:"cs3",title:"Threats & Vulnerabilities",subs:[
        {id:"csb6",title:"Malware Taxonomy",done:false},
        {id:"csb7",title:"Social Engineering",done:false},
      ]},
    ],
  },
];

const SEED_LABS = {
  htb: [
    {id:"h1",name:"Lame",diff:"easy",os:"Linux",comp:"pwned",writeup:"done",notes:"VSFTPd + Samba. CVE-2007-2447 via distcc. Scan ALL ports.",writeupUrl:"https://0xdf.gitlab.io/2020/04/07/htb-lame.html",completed:"2026-02-10"},
    {id:"h2",name:"Blue",diff:"easy",os:"Windows",comp:"pwned",writeup:"draft",notes:"EternalBlue MS17-010.",writeupUrl:"",completed:"2026-02-18"},
    {id:"h3",name:"Photobomb",diff:"easy",os:"Linux",comp:"inprogress",writeup:"none",notes:"",writeupUrl:"",completed:""},
    {id:"h4",name:"Forest",diff:"medium",os:"Windows",comp:"todo",writeup:"none",notes:"",writeupUrl:"",completed:""},
  ],
  thm: [
    {id:"t1",name:"Pre-Security Path",diff:"easy",os:"Multi",comp:"pwned",writeup:"done",notes:"Great intro ~10h.",writeupUrl:"",completed:"2026-01-20"},
    {id:"t2",name:"OWASP Top 10",diff:"medium",os:"Web",comp:"pwned",writeup:"draft",notes:"SQLi, XSS, IDOR, SSRF.",writeupUrl:"",completed:"2026-02-05"},
  ],
  hs: [
    {id:"hs1",name:"Web App Exploitation",diff:"easy",os:"Web",comp:"pwned",writeup:"done",notes:"SQLI, XSS, CSRF in depth.",writeupUrl:"",completed:"2026-02-28"},
    {id:"hs2",name:"Network Recon",diff:"medium",os:"Multi",comp:"inprogress",writeup:"draft",notes:"Nmap, Masscan, gobuster.",writeupUrl:"",completed:""},
  ],
};

const POMO=25*60, SHORT=5*60, LONG=15*60;

// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]           = useState("timer");
  const [platTab, setPlatTab]   = useState("htb");

  // Pomodoro
  const [mode, setMode]         = useState("work");
  const [time, setTime]         = useState(POMO);
  const [running, setRunning]   = useState(false);
  const [sess, setSess]         = useState(1);
  const [donePomo, setDonePomo] = useState(0);
  const [flash, setFlash]       = useState(false);
  const [activeLink, setActiveLink] = useState(null); // {type:"course"|"cert", id}
  const iv = useRef(null);

  // Data
  const [courses, setCourses]   = useState(SEED_COURSES);
  const [certs, setCerts]       = useState(SEED_CERTS);
  const [labs, setLabs]         = useState(SEED_LABS);
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [logs, setLogs]         = useState([]);

  // Sub-tab
  const [studyTab, setStudyTab] = useState("courses"); // "courses" | "certs"

  // UI modals
  const [expandedItem, setExpandedItem]   = useState(null);
  const [editDatesFor, setEditDatesFor]   = useState(null);
  const [addSectionFor, setAddSectionFor] = useState(null); // {type, id}
  const [addSubFor, setAddSubFor]         = useState(null);  // {type, itemId, secId}
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddCert, setShowAddCert]     = useState(false);
  const [showAddLab, setShowAddLab]       = useState(null);  // platform key
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [writeupFor, setWriteupFor]       = useState(null);  // {plat, id}
  const [confirmDelPlat, setConfirmDelPlat] = useState(null);

  const dur  = mode==="work"?POMO:mode==="short"?SHORT:LONG;
  const prog = 1-time/dur;
  const ringC= mode==="work"?TN.orange:mode==="short"?TN.green:TN.purple;

  // Timer tick
  useEffect(()=>{
    if(running){
      iv.current=setInterval(()=>{
        setTime(v=>{
          if(v<=1){
            clearInterval(iv.current); setRunning(false);
            setFlash(true); setTimeout(()=>setFlash(false),1400);
            if(mode==="work"){
              setDonePomo(p=>p+1); setSess(s=>s+1);
              if(activeLink){
                const ts=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
                setLogs(l=>[{id:uid(),time:ts,link:activeLink},...l.slice(0,49)]);
                if(activeLink.type==="course") setCourses(cs=>cs.map(c=>c.id===activeLink.id?{...c,sessions:c.sessions+1}:c));
                else setCerts(cs=>cs.map(c=>c.id===activeLink.id?{...c,sessions:c.sessions+1}:c));
              }
            }
            return 0;
          }
          return v-1;
        });
      },1000);
    } else clearInterval(iv.current);
    return ()=>clearInterval(iv.current);
  },[running,mode,activeLink]);

  const switchMode=m=>{setMode(m);setRunning(false);setTime(m==="work"?POMO:m==="short"?SHORT:LONG);};

  // Helpers
  const allSubs=it=>it.sections.flatMap(s=>s.subs);
  const iprog=it=>{const s=allSubs(it);return s.length?Math.round(s.filter(x=>x.done).length/s.length*100):0;};

  const toggleSubItem=(type,iid,sid,sbid)=>{
    const setter=type==="course"?setCourses:setCerts;
    setter(cs=>cs.map(c=>c.id!==iid?c:{...c,sections:c.sections.map(s=>s.id!==sid?s:{...s,subs:s.subs.map(sb=>sb.id!==sbid?sb:{...sb,done:!sb.done})})}));
  };
  const delSectionItem=(type,iid,sid)=>{
    const setter=type==="course"?setCourses:setCerts;
    setter(cs=>cs.map(c=>c.id!==iid?c:{...c,sections:c.sections.filter(s=>s.id!==sid)}));
  };
  const delSubItem=(type,iid,sid,sbid)=>{
    const setter=type==="course"?setCourses:setCerts;
    setter(cs=>cs.map(c=>c.id!==iid?c:{...c,sections:c.sections.map(s=>s.id!==sid?s:{...s,subs:s.subs.filter(sb=>sb.id!==sbid)})}));
  };
  const setItemDate=(type,id,f,v)=>{
    const setter=type==="course"?setCourses:setCerts;
    setter(cs=>cs.map(c=>c.id!==id?c:{...c,[f]:v}));
  };
  const delItem=(type,id)=>{
    if(type==="course") setCourses(cs=>cs.filter(c=>c.id!==id));
    else setCerts(cs=>cs.filter(c=>c.id!==id));
    if(activeLink?.id===id) setActiveLink(null);
  };

  // Lab helpers
  const setLabField=(plat,id,f,v)=>setLabs(lb=>({...lb,[plat]:lb[plat].map(l=>l.id!==id?l:{...l,[f]:v})}));
  const delLab=(plat,id)=>setLabs(lb=>({...lb,[plat]:lb[plat].filter(l=>l.id!==id)}));
  const addLab=(plat,data)=>setLabs(lb=>({...lb,[plat]:[...lb[plat],{...data,id:uid(),notes:"",writeupUrl:"",completed:""}]}));

  const addPlatform=(data)=>{
    setPlatforms(ps=>[...ps,{...data,key:data.key,removable:true}]);
    setLabs(lb=>({...lb,[data.key]:[]}));
  };
  const removePlatform=(key)=>{
    setPlatforms(ps=>ps.filter(p=>p.key!==key));
    setLabs(lb=>{ const n={...lb}; delete n[key]; return n; });
    if(platTab===key) setPlatTab("htb");
    setConfirmDelPlat(null);
  };

  // Stats
  const totalCourseH=((courses.reduce((a,c)=>a+c.sessions,0)*25)/60).toFixed(1);
  const totalCertH=((certs.reduce((a,c)=>a+c.sessions,0)*25)/60).toFixed(1);
  const allLabsFlat=Object.values(labs).flat();
  const pwnedCount=allLabsFlat.filter(l=>l.comp==="pwned").length;
  const wuCount=allLabsFlat.filter(l=>l.writeup==="done"||l.writeup==="published").length;
  const totalPomo=donePomo;

  return (
    <div style={{minHeight:"100vh",maxHeight:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",background:TN.bgDark,color:TN.fg,fontFamily:"'JetBrains Mono',monospace"}}>
      <TNStyles/>

      {/* ── HEADER ── */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:50,borderBottom:`1px solid ${TN.border}`,background:TN.bgDeep,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <svg width="18" height="18" viewBox="0 0 20 20">
            <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="none" stroke={TN.blue} strokeWidth="1.5"/>
            <polygon points="10,5 14,7.5 14,12.5 10,15 6,12.5 6,7.5" fill={TN.blue} opacity=".2"/>
          </svg>
          <span style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:13,color:TN.blue,letterSpacing:2}}>certflow</span>
          <span style={{color:TN.fgDim,fontSize:10,margin:"0 2px"}}>/</span>
          <span style={{fontSize:8,color:TN.fgDim,letterSpacing:1}}>v5</span>
        </div>
        <div style={{display:"flex"}}>
          {[["timer","timer"],["study","study"],["labs","labs"],["calendar","calendar"],["log","log"]].map(([k,l])=>(
            <button key={k} className={`tn-tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:14,fontSize:9}}>
          {[[TN.orange,"🍅",totalPomo],[TN.green,"⚡",`${pwnedCount}/${allLabsFlat.length}`],[TN.cyan,"✍",wuCount]].map(([c,i,v],idx)=>(
            <span key={idx} style={{color:TN.fgMuted}}>{i}<b style={{color:c,marginLeft:3}}>{v}</b></span>
          ))}
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{flex:1,overflow:"auto",padding:"18px 20px"}}>

        {/* ════ TIMER ════ */}
        {tab==="timer" && (
          <div style={{maxWidth:440,margin:"0 auto"}}>
            <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:24}}>
              {[["work","focus",TN.orange],["short","break",TN.green],["long","long break",TN.purple]].map(([m,l,c])=>(
                <button key={m} onClick={()=>switchMode(m)} style={{background:mode===m?c+"18":"none",border:`1px solid ${mode===m?c:TN.border}`,borderRadius:4,color:mode===m?c:TN.fgMuted,fontFamily:"inherit",fontSize:9,padding:"5px 14px",cursor:"pointer",transition:"all .2s"}}>{l}</button>
              ))}
            </div>

            <div className={flash?"tn-flash":""} style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:22}}>
              <div style={{position:"relative",width:210,height:210}}>
                <div style={{position:"absolute",inset:0,borderRadius:"50%",background:`radial-gradient(circle,${ringC}08 0%,transparent 70%)`}}/>
                <svg width="210" height="210" style={{transform:"rotate(-90deg)",position:"relative",zIndex:1}}>
                  <circle cx="105" cy="105" r="58" fill="none" stroke={TN.bgPanel} strokeWidth="8"/>
                  <circle cx="105" cy="105" r="76" fill="none" stroke={TN.border} strokeWidth=".5" strokeDasharray="3 9"/>
                  <circle cx="105" cy="105" r="42" fill="none" stroke={TN.border} strokeWidth=".5" strokeDasharray="2 5"/>
                  <circle cx="105" cy="105" r="58" fill="none" stroke={ringC} strokeWidth="8" strokeLinecap="round"
                    {...ringP(prog,58)} style={{transition:"stroke-dashoffset .5s linear,stroke .4s",filter:`drop-shadow(0 0 6px ${ringC}88)`}}/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:2}}>
                  <div style={{fontFamily:"'Fira Code',monospace",fontSize:40,fontWeight:700,letterSpacing:4,lineHeight:1,color:TN.fg,textShadow:`0 0 20px ${ringC}44`}}>{fmtT(time)}</div>
                  <div style={{fontSize:8,color:TN.fgMuted,letterSpacing:3,marginTop:6}}>{mode==="work"?"deep focus":mode==="short"?"short break":"long break"}</div>
                  {running&&<div style={{width:4,height:4,borderRadius:"50%",background:ringC,marginTop:8}} className="tn-pulse"/>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginTop:10}}>
                {[1,2,3,4].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:i<=(sess-1)%4?ringC:TN.border,transition:"all .3s",boxShadow:i<=(sess-1)%4?`0 0 6px ${ringC}88`:""}}/>)}
              </div>
              <div style={{fontSize:8,color:TN.fgDim,marginTop:4,letterSpacing:2}}>session {sess}</div>
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:22}}>
              <button className="tn-gbtn" onClick={()=>{setRunning(false);setTime(dur);}}>reset</button>
              <button className="tn-pbtn" onClick={()=>setRunning(r=>!r)} style={{minWidth:90,borderColor:ringC,color:ringC,background:running?ringC+"22":"none"}}>{running?"pause":"start"}</button>
            </div>

            {/* Link to course or cert */}
            <div className="tn-card">
              <div style={{display:"flex",gap:10,marginBottom:10}}>
                <div className="tn-label" style={{marginBottom:0}}>link session →</div>
              </div>
              {/* Courses */}
              {courses.length>0&&(
                <>
                  <div style={{fontSize:7,color:TN.fgDim,letterSpacing:2,marginBottom:5,paddingLeft:2}}>// courses</div>
                  {courses.map(c=>{
                    const active=activeLink?.type==="course"&&activeLink?.id===c.id;
                    return (
                      <div key={c.id} onClick={()=>setActiveLink(active?null:{type:"course",id:c.id})} className="tn-crow"
                        style={{borderColor:active?c.color:TN.border,background:active?c.color+"10":"none"}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:c.color,flexShrink:0,boxShadow:`0 0 5px ${c.color}88`}}/>
                        <span style={{flex:1,fontSize:10,color:active?TN.fg:TN.fgMuted}}>{c.name}</span>
                        <span style={{fontSize:7,color:TN.fgDim,letterSpacing:1,background:TN.bgPanel,padding:"1px 5px",borderRadius:2}}>course</span>
                        {active&&<span style={{fontSize:8,color:c.color}}>●</span>}
                      </div>
                    );
                  })}
                </>
              )}
              {/* Certs */}
              {certs.length>0&&(
                <>
                  <div style={{fontSize:7,color:TN.fgDim,letterSpacing:2,margin:"8px 0 5px",paddingLeft:2}}>// certifications</div>
                  {certs.map(c=>{
                    const active=activeLink?.type==="cert"&&activeLink?.id===c.id;
                    const dl=dLeft(c.examDate);
                    return (
                      <div key={c.id} onClick={()=>setActiveLink(active?null:{type:"cert",id:c.id})} className="tn-crow"
                        style={{borderColor:active?c.color:TN.border,background:active?c.color+"10":"none"}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:c.color,flexShrink:0,boxShadow:`0 0 5px ${c.color}88`}}/>
                        <span style={{flex:1,fontSize:10,color:active?TN.fg:TN.fgMuted}}>{c.name}</span>
                        <span style={{fontSize:7,color:TN.fgDim,letterSpacing:1,background:TN.bgPanel,padding:"1px 5px",borderRadius:2}}>cert</span>
                        {dl!==null&&<span style={{fontSize:8,color:dl<14?TN.red:dl<30?TN.yellow:TN.fgDim,marginLeft:4}}>{dl}d</span>}
                        {active&&<span style={{fontSize:8,color:c.color,marginLeft:4}}>●</span>}
                      </div>
                    );
                  })}
                </>
              )}
              {courses.length===0&&certs.length===0&&<div style={{fontSize:10,color:TN.fgDim}}>// add a course or cert first</div>}
            </div>
          </div>
        )}

        {/* ════ STUDY (COURSES + CERTS) ════ */}
        {tab==="study" && (
          <div style={{maxWidth:760,margin:"0 auto"}}>
            {/* Sub-tab switcher */}
            <div style={{display:"flex",gap:0,marginBottom:20,background:TN.bgDeep,borderRadius:6,padding:3,width:"fit-content",border:`1px solid ${TN.border}`}}>
              {[["courses","📖 Courses",TN.teal],["certs","🎯 Certifications",TN.orange]].map(([k,l,c])=>(
                <button key={k} onClick={()=>setStudyTab(k)}
                  style={{background:studyTab===k?TN.bgPanel:"none",border:`1px solid ${studyTab===k?c:"transparent"}`,borderRadius:4,padding:"7px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:10,color:studyTab===k?c:TN.fgMuted,transition:"all .2s",letterSpacing:.5}}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── COURSES ── */}
            {studyTab==="courses" && (
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18}}>
                  {[[TN.teal,"courses",courses.length],[TN.blue,"sessions",courses.reduce((a,c)=>a+c.sessions,0)],[TN.purple,"hours",totalCourseH+"h"],[TN.green,"avg prog",courses.length?Math.round(courses.reduce((a,c)=>a+iprog(c),0)/courses.length)+"%":"0%"]].map(([c,l,v])=>(
                    <div key={l} className="tn-scard" style={{borderColor:c+"33"}}>
                      <div style={{fontSize:8,color:c,letterSpacing:2,marginBottom:4}}>{l}</div>
                      <div style={{fontSize:18,fontFamily:"'Fira Code',monospace",fontWeight:700,color:TN.fg}}>{v}</div>
                    </div>
                  ))}
                </div>

                {courses.map(c=>{
                  const pct=iprog(c), exp=expandedItem===c.id;
                  const dlEnd=dLeft(c.endDate);
                  return (
                    <div key={c.id} className="tn-cblock" style={{borderColor:exp?c.color+"66":TN.border}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:c.color,marginTop:3,flexShrink:0,boxShadow:`0 0 7px ${c.color}66`}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:13,color:TN.fg,marginBottom:3}}>{c.name}</div>
                          {c.provider&&<div style={{fontSize:8,color:TN.fgDim,marginBottom:6,letterSpacing:.5}}>via {c.provider}</div>}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,maxWidth:280}}>
                            <SmallDateBox label="start" date={c.startDate} color={TN.fgMuted}/>
                            <SmallDateBox label="end" date={c.endDate} color={dlEnd!==null&&dlEnd<14?TN.red:dlEnd!==null&&dlEnd<30?TN.yellow:c.color} days={dlEnd}/>
                          </div>
                          <div style={{fontSize:8,color:TN.fgDim,marginTop:5}}>🍅 {c.sessions} sessions · {((c.sessions*25)/60).toFixed(1)}h</div>
                        </div>
                        <div style={{display:"flex",gap:2,flexShrink:0}}>
                          <button className="tn-ibtn" title="Edit dates" onClick={()=>setEditDatesFor(editDatesFor===c.id?null:c.id)}>✎</button>
                          <button className="tn-ibtn" onClick={()=>delItem("course",c.id)}>✕</button>
                        </div>
                      </div>

                      {editDatesFor===c.id&&(
                        <div style={{background:TN.bgDeep,border:`1px solid ${TN.border}`,borderRadius:5,padding:12,marginBottom:12}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                            {[["startDate","START DATE"],["endDate","END DATE"],["provider","PROVIDER"]].map(([f,l])=>(
                              <div key={f}>
                                <div className="tn-label" style={{marginBottom:3}}>{l}</div>
                                {f==="provider"
                                  ? <input className="tn-dinput" style={{width:"100%"}} value={c[f]||""} placeholder="e.g. Coursera" onChange={e=>setItemDate("course",c.id,f,e.target.value)}/>
                                  : <input type="date" className="tn-dinput" style={{width:"100%"}} value={c[f]||""} onChange={e=>setItemDate("course",c.id,f,e.target.value)}/>
                                }
                              </div>
                            ))}
                          </div>
                          <button className="tn-pbtn" style={{marginTop:10,fontSize:8,padding:"5px 12px",color:TN.green,borderColor:TN.green,background:TN.green+"15"}} onClick={()=>setEditDatesFor(null)}>save ✓</button>
                        </div>
                      )}

                      <ProgressBar pct={pct} color={c.color}/>

                      <button className="tn-xbtn" onClick={()=>setExpandedItem(exp?null:c.id)}>
                        {exp?"▲ collapse":"▼ sections"} ({c.sections.reduce((a,s)=>a+s.subs.length,0)} topics · {c.sections.length} sections)
                      </button>

                      {exp&&<SectionEditor type="course" item={c} color={c.color}
                        onToggleSub={(sid,sbid)=>toggleSubItem("course",c.id,sid,sbid)}
                        onDelSection={sid=>delSectionItem("course",c.id,sid)}
                        onDelSub={(sid,sbid)=>delSubItem("course",c.id,sid,sbid)}
                        onAddSection={()=>setAddSectionFor({type:"course",id:c.id})}
                        onAddSub={(sid)=>setAddSubFor({type:"course",itemId:c.id,secId:sid})}
                      />}
                    </div>
                  );
                })}

                <button className="tn-addcbtn" onClick={()=>setShowAddCourse(true)}>+ add course</button>
              </>
            )}

            {/* ── CERTS ── */}
            {studyTab==="certs" && (
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18}}>
                  {[[TN.orange,"certifications",certs.length],[TN.blue,"sessions",certs.reduce((a,c)=>a+c.sessions,0)],[TN.purple,"hours",totalCertH+"h"],[TN.green,"passed",certs.filter(c=>c.passed).length]].map(([c,l,v])=>(
                    <div key={l} className="tn-scard" style={{borderColor:c+"33"}}>
                      <div style={{fontSize:8,color:c,letterSpacing:2,marginBottom:4}}>{l}</div>
                      <div style={{fontSize:18,fontFamily:"'Fira Code',monospace",fontWeight:700,color:TN.fg}}>{v}</div>
                    </div>
                  ))}
                </div>

                {certs.map(c=>{
                  const pct=iprog(c), exp=expandedItem===c.id;
                  const dlExam=dLeft(c.examDate), dlEnd=dLeft(c.studyEnd);
                  return (
                    <div key={c.id} className="tn-cblock" style={{borderColor:exp?c.color+"66":TN.border}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:c.color,marginTop:3,flexShrink:0,boxShadow:`0 0 7px ${c.color}66`}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:13,color:TN.fg}}>{c.name}</div>
                            {c.passed&&<span style={{fontSize:7,padding:"1px 7px",borderRadius:10,background:TN.green+"22",color:TN.green,border:`1px solid ${TN.green}44`,letterSpacing:1}}>PASSED ✓</span>}
                          </div>
                          {c.vendor&&<div style={{fontSize:8,color:TN.fgDim,marginBottom:6,letterSpacing:.5}}>by {c.vendor}</div>}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                            <SmallDateBox label="enrolled" date={c.certStart} color={TN.cyan}/>
                            <SmallDateBox label="study start" date={c.studyStart} color={TN.fgMuted}/>
                            <SmallDateBox label="study end" date={c.studyEnd} color={dlEnd!==null&&dlEnd<14?TN.red:dlEnd!==null&&dlEnd<30?TN.yellow:TN.fgMuted} days={dlEnd}/>
                            <SmallDateBox label="exam ★" date={c.examDate} color={dlExam!==null&&dlExam<14?TN.red:dlExam!==null&&dlExam<30?TN.yellow:c.color} days={dlExam} highlight/>
                          </div>
                          <div style={{fontSize:8,color:TN.fgDim,marginTop:5}}>🍅 {c.sessions} sessions · {((c.sessions*25)/60).toFixed(1)}h</div>
                        </div>
                        <div style={{display:"flex",gap:2,flexShrink:0}}>
                          <button className="tn-ibtn" title="Toggle passed" onClick={()=>setCerts(cs=>cs.map(x=>x.id===c.id?{...x,passed:!x.passed}:x))} style={{color:c.passed?TN.green:TN.fgDim,fontSize:13}}>✓</button>
                          <button className="tn-ibtn" title="Edit dates" onClick={()=>setEditDatesFor(editDatesFor===c.id?null:c.id)}>✎</button>
                          <button className="tn-ibtn" onClick={()=>delItem("cert",c.id)}>✕</button>
                        </div>
                      </div>

                      {editDatesFor===c.id&&(
                        <div style={{background:TN.bgDeep,border:`1px solid ${TN.border}`,borderRadius:5,padding:12,marginBottom:12}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:8}}>
                            {[["certStart","ENROLLED"],["studyStart","STUDY START"],["studyEnd","STUDY END"],["examDate","EXAM DATE"],["vendor","VENDOR"]].map(([f,l])=>(
                              <div key={f}>
                                <div className="tn-label" style={{marginBottom:3}}>{l}</div>
                                {f==="vendor"
                                  ? <input className="tn-dinput" style={{width:"100%"}} value={c[f]||""} placeholder="e.g. AWS" onChange={e=>setItemDate("cert",c.id,f,e.target.value)}/>
                                  : <input type="date" className="tn-dinput" style={{width:"100%"}} value={c[f]||""} onChange={e=>setItemDate("cert",c.id,f,e.target.value)}/>
                                }
                              </div>
                            ))}
                          </div>
                          <button className="tn-pbtn" style={{marginTop:10,fontSize:8,padding:"5px 12px",color:TN.green,borderColor:TN.green,background:TN.green+"15"}} onClick={()=>setEditDatesFor(null)}>save ✓</button>
                        </div>
                      )}

                      <ProgressBar pct={pct} color={c.color}/>

                      <button className="tn-xbtn" onClick={()=>setExpandedItem(exp?null:c.id)}>
                        {exp?"▲ collapse":"▼ syllabus"} ({c.sections.reduce((a,s)=>a+s.subs.length,0)} topics · {c.sections.length} sections)
                      </button>

                      {exp&&<SectionEditor type="cert" item={c} color={c.color}
                        onToggleSub={(sid,sbid)=>toggleSubItem("cert",c.id,sid,sbid)}
                        onDelSection={sid=>delSectionItem("cert",c.id,sid)}
                        onDelSub={(sid,sbid)=>delSubItem("cert",c.id,sid,sbid)}
                        onAddSection={()=>setAddSectionFor({type:"cert",id:c.id})}
                        onAddSub={(sid)=>setAddSubFor({type:"cert",itemId:c.id,secId:sid})}
                      />}
                    </div>
                  );
                })}

                <button className="tn-addcbtn" style={{borderColor:TN.orange+"55",color:TN.fgDim}} onClick={()=>setShowAddCert(true)}>+ add certification</button>
              </>
            )}
          </div>
        )}

        {/* ════ LABS ════ */}
        {tab==="labs" && (
          <div style={{maxWidth:940,margin:"0 auto"}}>
            {/* Platform strip + add platform */}
            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"stretch"}}>
              {platforms.map(p=>{
                const pl=labs[p.key]||[];
                const pwned=pl.filter(l=>l.comp==="pwned").length;
                const wu=pl.filter(l=>l.writeup==="done"||l.writeup==="published").length;
                const active=platTab===p.key;
                return (
                  <button key={p.key} onClick={()=>setPlatTab(p.key)}
                    style={{flex:"1 1 140px",minWidth:130,background:active?TN.bgPanel:TN.bgDeep,border:`1px solid ${active?p.color:TN.border}`,borderRadius:6,padding:"10px 12px",cursor:"pointer",fontFamily:"inherit",transition:"all .2s",boxShadow:active?`0 0 14px ${p.color}28`:"none",textAlign:"left",outline:"none",position:"relative"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:15,filter:active?`drop-shadow(0 0 5px ${p.color})`:"none"}}>{p.icon}</span>
                        <span style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:10,color:active?p.color:TN.fgMuted,letterSpacing:.5}}>{p.name}</span>
                      </div>
                      <div style={{display:"flex",gap:3}}>
                        {/* + add lab */}
                        <div onClick={e=>{e.stopPropagation();setPlatTab(p.key);setShowAddLab(p.key);}}
                          title="Add lab"
                          style={{width:20,height:20,borderRadius:3,background:active?p.color+"22":TN.bgPanel,border:`1px solid ${active?p.color:TN.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:active?p.color:TN.fgDim,fontSize:14,lineHeight:1,transition:"all .2s"}}
                          onMouseEnter={e=>{e.currentTarget.style.background=p.color+"33";e.currentTarget.style.borderColor=p.color;e.currentTarget.style.color=p.color;}}
                          onMouseLeave={e=>{e.currentTarget.style.background=active?p.color+"22":TN.bgPanel;e.currentTarget.style.borderColor=active?p.color:TN.border;e.currentTarget.style.color=active?p.color:TN.fgDim;}}>
                          +
                        </div>
                        {/* remove platform (custom only) */}
                        {p.removable&&(
                          <div onClick={e=>{e.stopPropagation();setConfirmDelPlat(p.key);}}
                            title="Remove platform"
                            style={{width:20,height:20,borderRadius:3,background:"none",border:`1px solid ${TN.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:TN.fgDim,fontSize:10,lineHeight:1,transition:"all .2s"}}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor=TN.red;e.currentTarget.style.color=TN.red;}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=TN.border;e.currentTarget.style.color=TN.fgDim;}}>
                            ✕
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{fontSize:7,color:active?p.color+"99":TN.fgDim,marginBottom:6}}>{pwned}/{pl.length} pwned · {wu} writeups</div>
                    <div style={{height:2,background:TN.border,borderRadius:1,overflow:"hidden"}}>
                      <div style={{height:"100%",width:(pl.length?pwned/pl.length*100:0)+"%",background:p.color,transition:"width .6s"}}/>
                    </div>
                  </button>
                );
              })}

              {/* Add platform button */}
              <button onClick={()=>setShowAddPlatform(true)}
                style={{flex:"0 0 auto",minWidth:100,background:"none",border:`1px dashed ${TN.border}`,borderRadius:6,padding:"10px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:9,color:TN.fgDim,letterSpacing:1,transition:"all .2s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=TN.blue+"88";e.currentTarget.style.color=TN.blue;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=TN.border;e.currentTarget.style.color=TN.fgDim;}}>
                <span style={{fontSize:20,lineHeight:1}}>+</span>
                <span style={{fontSize:8,letterSpacing:1.5}}>platform</span>
              </button>
            </div>

            {/* Active platform view */}
            {(() => {
              const p=platforms.find(x=>x.key===platTab);
              if(!p) return null;
              const pl=labs[platTab]||[];
              const byDiff=DIFFICULTIES.map(d=>({...d,count:pl.filter(l=>l.diff===d.key).length}));
              const pwned=pl.filter(l=>l.comp==="pwned").length;
              const wu=pl.filter(l=>l.writeup==="done"||l.writeup==="published").length;
              return (
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr 1fr 1fr",gap:8,alignItems:"center",marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:10,borderRight:`1px solid ${TN.border}`}}>
                      <span style={{fontSize:22,filter:`drop-shadow(0 0 7px ${p.color})`}}>{p.icon}</span>
                      <div>
                        <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:13,color:p.color}}>{p.name}</div>
                        <div style={{fontSize:8,color:TN.fgDim,marginTop:1}}>{pwned}/{pl.length} pwned · {wu} writeups</div>
                      </div>
                    </div>
                    {byDiff.map(d=>(
                      <div key={d.key} className="tn-scard" style={{textAlign:"center",borderColor:d.count>0?d.color+"44":TN.border}}>
                        <div style={{fontSize:7,color:d.color,letterSpacing:1.5,marginBottom:3}}>{d.label}</div>
                        <div style={{fontSize:18,fontFamily:"'Fira Code',monospace",fontWeight:700,color:d.count>0?d.color:TN.fgDim}}>{d.count}</div>
                      </div>
                    ))}
                    <button className="tn-pbtn" onClick={()=>setShowAddLab(platTab)}
                      style={{color:p.color,borderColor:p.color,background:p.color+"15",display:"flex",alignItems:"center",gap:6,justifyContent:"center",padding:"10px 10px",fontSize:10}}>
                      <span style={{fontSize:18,lineHeight:1}}>+</span>add lab
                    </button>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {pl.map(lab=>{
                      const cs=COMP_STATUS.find(s=>s.key===lab.comp)||COMP_STATUS[0];
                      const ws=WRITEUP_STATUS.find(s=>s.key===lab.writeup)||WRITEUP_STATUS[0];
                      const df=DIFFICULTIES.find(d=>d.key===lab.diff)||DIFFICULTIES[0];
                      const hasLink=lab.writeupUrl&&validUrl(lab.writeupUrl);
                      return (
                        <div key={lab.id} className="tn-labcard"
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=p.color+"55";e.currentTarget.style.boxShadow=`0 0 14px ${p.color}18`;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=TN.border;e.currentTarget.style.boxShadow="none";}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                            <div>
                              <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:12,marginBottom:5,color:TN.fg}}>{lab.name}</div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                <span style={{fontSize:7,padding:"2px 7px",borderRadius:3,background:df.color+"18",color:df.color,border:`1px solid ${df.color}33`}}>{df.label}</span>
                                {lab.os&&<span style={{fontSize:7,padding:"2px 7px",borderRadius:3,background:TN.bgPanel,color:TN.fgMuted,border:`1px solid ${TN.border}`}}>{lab.os}</span>}
                                {lab.completed&&<span style={{fontSize:7,color:TN.fgDim}}>✓ {fmtD(lab.completed)}</span>}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:2}}>
                              <button className="tn-ibtn" onClick={()=>setWriteupFor({plat:platTab,id:lab.id})} style={{color:p.color+"88",fontSize:13}}>✎</button>
                              <button className="tn-ibtn" onClick={()=>delLab(platTab,lab.id)}>✕</button>
                            </div>
                          </div>

                          {/* Dual status */}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                            <div>
                              <div style={{fontSize:7,color:TN.fgDim,letterSpacing:1.5,marginBottom:5}}>completion</div>
                              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                {COMP_STATUS.map(s=>(
                                  <button key={s.key} onClick={()=>setLabField(platTab,lab.id,"comp",s.key)} className="tn-sbtn"
                                    style={{borderColor:lab.comp===s.key?s.fg:TN.border,background:lab.comp===s.key?s.bg:"none",color:lab.comp===s.key?s.fg:TN.fgDim}}>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div style={{fontSize:7,color:TN.fgDim,letterSpacing:1.5,marginBottom:5}}>writeup</div>
                              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                {WRITEUP_STATUS.map(s=>(
                                  <button key={s.key} onClick={()=>setLabField(platTab,lab.id,"writeup",s.key)} className="tn-sbtn"
                                    style={{borderColor:lab.writeup===s.key?s.fg:TN.border,background:lab.writeup===s.key?s.bg:"none",color:lab.writeup===s.key?s.fg:TN.fgDim}}>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Writeup link */}
                          {hasLink&&(
                            <a href={lab.writeupUrl} target="_blank" rel="noreferrer"
                              style={{display:"flex",alignItems:"center",gap:6,background:TN.bgPanel,border:`1px solid ${ws.fg}33`,borderRadius:4,padding:"5px 8px",marginBottom:8,textDecoration:"none",transition:"border-color .2s"}}
                              onMouseEnter={e=>e.currentTarget.style.borderColor=ws.fg+"77"}
                              onMouseLeave={e=>e.currentTarget.style.borderColor=ws.fg+"33"}>
                              <span style={{fontSize:10}}>🔗</span>
                              <span style={{flex:1,fontSize:9,color:TN.cyan,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"'Fira Code',monospace"}}>{lab.writeupUrl.replace(/^https?:\/\//,"")}</span>
                              <span style={{fontSize:9,color:TN.fgDim}}>↗</span>
                            </a>
                          )}

                          {/* Notes or prompt */}
                          {lab.notes?(
                            <div onClick={()=>setWriteupFor({plat:platTab,id:lab.id})}
                              style={{background:TN.bgDeep,borderLeft:`2px solid ${p.color}44`,padding:"6px 8px",borderRadius:"0 4px 4px 0",cursor:"pointer"}}>
                              <div style={{fontSize:9,color:TN.fgMuted,lineHeight:1.7,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{lab.notes}</div>
                            </div>
                          ):(
                            <div onClick={()=>setWriteupFor({plat:platTab,id:lab.id})}
                              style={{border:`1px dashed ${TN.border}`,borderRadius:4,padding:"6px 10px",cursor:"pointer",textAlign:"center",transition:"border-color .2s"}}
                              onMouseEnter={e=>e.currentTarget.style.borderColor=p.color+"66"}
                              onMouseLeave={e=>e.currentTarget.style.borderColor=TN.border}>
                              <span style={{fontSize:8,color:TN.fgDim}}>// click to add writeup notes or link</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {pl.length===0&&(
                    <div style={{textAlign:"center",padding:"50px 0",color:TN.fgDim}}>
                      <div style={{fontSize:28,marginBottom:8,opacity:.3}}>{p.icon}</div>
                      <div style={{fontSize:10,letterSpacing:2}}>// no labs yet</div>
                      <div style={{fontSize:8,marginTop:4,color:TN.fgDim}}>click + add lab or the + on the platform tab above</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ════ CALENDAR ════ */}
        {tab==="calendar" && <CalendarView courses={courses} certs={certs} setDate={setItemDate}/>}

        {/* ════ LOG ════ */}
        {tab==="log" && (
          <div style={{maxWidth:560,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:18,color:TN.fg}}>session log</div>
                <div style={{fontSize:9,color:TN.fgDim,marginTop:2}}>{logs.length} pomodoros recorded</div>
              </div>
              <div className="tn-scard" style={{textAlign:"center",borderColor:TN.orange+"44"}}>
                <div style={{fontSize:24,fontFamily:"'Fira Code',monospace",fontWeight:700,color:TN.orange}}>{donePomo}</div>
                <div style={{fontSize:7,color:TN.fgDim,letterSpacing:2,marginTop:2}}>today</div>
              </div>
            </div>

            {/* Courses */}
            {courses.filter(c=>c.sessions>0).length>0&&(
              <div className="tn-card" style={{marginBottom:14}}>
                <div className="tn-label">courses</div>
                {courses.filter(c=>c.sessions>0).map(c=>{
                  const max=Math.max(...courses.map(x=>x.sessions),1);
                  return <div key={c.id} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:TN.fgMuted,marginBottom:4}}>
                      <span>{c.name}</span><span style={{color:c.color}}>{c.sessions}🍅 · {((c.sessions*25)/60).toFixed(1)}h</span>
                    </div>
                    <div style={{height:2,background:TN.border,borderRadius:1}}>
                      <div style={{height:"100%",width:(c.sessions/max*100)+"%",background:c.color,borderRadius:1,transition:"width .5s"}}/>
                    </div>
                  </div>;
                })}
              </div>
            )}

            {/* Certs */}
            {certs.filter(c=>c.sessions>0).length>0&&(
              <div className="tn-card" style={{marginBottom:14}}>
                <div className="tn-label">certifications</div>
                {certs.filter(c=>c.sessions>0).map(c=>{
                  const max=Math.max(...certs.map(x=>x.sessions),1);
                  return <div key={c.id} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:TN.fgMuted,marginBottom:4}}>
                      <span>{c.name}</span><span style={{color:c.color}}>{c.sessions}🍅 · {((c.sessions*25)/60).toFixed(1)}h</span>
                    </div>
                    <div style={{height:2,background:TN.border,borderRadius:1}}>
                      <div style={{height:"100%",width:(c.sessions/max*100)+"%",background:c.color,borderRadius:1,transition:"width .5s"}}/>
                    </div>
                  </div>;
                })}
              </div>
            )}

            <div className="tn-card">
              <div className="tn-label">recent sessions</div>
              {logs.length===0?<div style={{fontSize:9,color:TN.fgDim}}>// no sessions yet</div>
              :logs.map(l=>{
                const isCourse=l.link?.type==="course";
                const item=isCourse?courses.find(c=>c.id===l.link?.id):certs.find(c=>c.id===l.link?.id);
                return <div key={l.id} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:`1px solid ${TN.bgPanel}`,fontSize:9}}>
                  <span style={{color:TN.fgDim,minWidth:44,fontFamily:"'Fira Code',monospace"}}>{l.time}</span>
                  {item&&<div style={{width:5,height:5,borderRadius:"50%",background:item.color,marginTop:2,flexShrink:0}}/>}
                  <span style={{flex:1,color:TN.fgMuted}}>{item?item.name:"free session"}</span>
                  <span style={{fontSize:7,color:TN.fgDim,letterSpacing:1}}>{l.link?.type||""}</span>
                </div>;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      {activeLink&&(()=>{
        const isCourse=activeLink.type==="course";
        const item=isCourse?courses.find(c=>c.id===activeLink.id):certs.find(c=>c.id===activeLink.id);
        if(!item) return null;
        const dl=isCourse?dLeft(item.endDate):dLeft(item.examDate);
        return (
          <div style={{padding:"6px 20px",borderTop:`1px solid ${TN.border}`,display:"flex",alignItems:"center",gap:8,fontSize:8,color:TN.fgDim,flexShrink:0,background:TN.bgDeep}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:item.color,boxShadow:`0 0 6px ${item.color}`}} className={running?"tn-pulse":""}/>
            <span>logging →</span>
            <span style={{color:TN.fg,fontFamily:"'Fira Code',monospace"}}>{item.name}</span>
            <span style={{fontSize:7,color:TN.fgDim,background:TN.bgPanel,padding:"1px 5px",borderRadius:2,letterSpacing:1}}>{activeLink.type}</span>
            {dl!==null&&<span style={{marginLeft:"auto",color:dl<14?TN.red:dl<30?TN.yellow:TN.fgDim,fontFamily:"'Fira Code',monospace"}}>{dl}d to {isCourse?"end":"exam"}</span>}
          </div>
        );
      })()}

      {/* ── MODALS ── */}
      {showAddCourse&&<AddCourseModal onClose={()=>setShowAddCourse(false)} onAdd={d=>{setCourses(cs=>[...cs,{...d,id:uid(),sessions:0,sections:[]}]);setShowAddCourse(false);}}/>}
      {showAddCert&&<AddCertModal onClose={()=>setShowAddCert(false)} onAdd={d=>{setCerts(cs=>[...cs,{...d,id:uid(),sessions:0,sections:[],passed:false}]);setShowAddCert(false);}}/>}
      {addSectionFor&&<MiniModal title={`add section — ${addSectionFor.type}`} ph="e.g. IAM & Security" onClose={()=>setAddSectionFor(null)} onAdd={v=>{
        const setter=addSectionFor.type==="course"?setCourses:setCerts;
        setter(cs=>cs.map(c=>c.id!==addSectionFor.id?c:{...c,sections:[...c.sections,{id:uid(),title:v,subs:[]}]}));
        setAddSectionFor(null);
      }}/>}
      {addSubFor&&<MiniModal title="add subtopic" ph="e.g. Users & Groups" onClose={()=>setAddSubFor(null)} onAdd={v=>{
        const setter=addSubFor.type==="course"?setCourses:setCerts;
        setter(cs=>cs.map(c=>c.id!==addSubFor.itemId?c:{...c,sections:c.sections.map(s=>s.id!==addSubFor.secId?s:{...s,subs:[...s.subs,{id:uid(),title:v,done:false}]})}));
        setAddSubFor(null);
      }}/>}
      {showAddLab&&<AddLabModal platform={platforms.find(p=>p.key===showAddLab)} onClose={()=>setShowAddLab(null)} onAdd={d=>{addLab(showAddLab,d);setShowAddLab(null);}}/>}
      {showAddPlatform&&<AddPlatformModal onClose={()=>setShowAddPlatform(false)} existingKeys={platforms.map(p=>p.key)} onAdd={d=>{addPlatform(d);setPlatTab(d.key);setShowAddPlatform(false);}}/>}
      {writeupFor&&<WriteupModal
        lab={labs[writeupFor.plat]?.find(l=>l.id===writeupFor.id)}
        platform={platforms.find(p=>p.key===writeupFor.plat)}
        onClose={()=>setWriteupFor(null)}
        onSave={(notes,url,completed)=>{
          setLabField(writeupFor.plat,writeupFor.id,"notes",notes);
          setLabField(writeupFor.plat,writeupFor.id,"writeupUrl",url);
          if(completed) setLabField(writeupFor.plat,writeupFor.id,"completed",completed);
          setWriteupFor(null);
        }}
      />}
      {confirmDelPlat&&(
        <TNModal title="remove platform" onClose={()=>setConfirmDelPlat(null)} accent={TN.red}>
          <div style={{fontSize:11,color:TN.fgMuted,marginBottom:6}}>Remove <b style={{color:TN.red}}>{platforms.find(p=>p.key===confirmDelPlat)?.name}</b>?</div>
          <div style={{fontSize:9,color:TN.fgDim,marginBottom:20}}>This will delete all {labs[confirmDelPlat]?.length||0} labs in this platform. This cannot be undone.</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button className="tn-gbtn" onClick={()=>setConfirmDelPlat(null)}>cancel</button>
            <button className="tn-pbtn" style={{color:TN.red,borderColor:TN.red,background:TN.red+"15"}} onClick={()=>removePlatform(confirmDelPlat)}>remove ✕</button>
          </div>
        </TNModal>
      )}
    </div>
  );
}

// ── REUSABLE COMPONENTS ────────────────────────────────────────────────
function ProgressBar({pct,color}){
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:TN.fgMuted,marginBottom:4}}>
        <span>progress</span>
        <span style={{color:pct===100?TN.green:color}}>{pct}%{pct===100?" ✓":""}</span>
      </div>
      <div style={{height:2,background:TN.border,borderRadius:1}}>
        <div style={{height:"100%",width:pct+"%",background:pct===100?TN.green:`linear-gradient(90deg,${color}44,${color})`,borderRadius:1,transition:"width .6s",boxShadow:pct>0?`0 0 5px ${color}55`:""}}/>
      </div>
    </div>
  );
}

function SectionEditor({type,item,color,onToggleSub,onDelSection,onDelSub,onAddSection,onAddSub}){
  return (
    <div style={{marginTop:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div className="tn-label">sections</div>
        <button className="tn-ailbtn" onClick={onAddSection}>+ section</button>
      </div>
      {item.sections.map(sec=>{
        const sdone=sec.subs.filter(s=>s.done).length;
        const spct=sec.subs.length?Math.round(sdone/sec.subs.length*100):0;
        return (
          <div key={sec.id} style={{marginBottom:8,borderRadius:5,overflow:"hidden",border:`1px solid ${TN.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:TN.bgPanel}}>
              <div style={{width:4,height:4,background:color,flexShrink:0}}/>
              <span style={{flex:1,fontSize:10,fontFamily:"'Fira Code',monospace",fontWeight:600,color:TN.fgMuted}}>{sec.title}</span>
              <div style={{width:28,height:2,background:TN.border,borderRadius:1,overflow:"hidden"}}>
                <div style={{height:"100%",width:spct+"%",background:spct===100?TN.green:color}}/>
              </div>
              <span style={{fontSize:8,color:TN.fgDim,minWidth:26}}>{sdone}/{sec.subs.length}</span>
              <button className="tn-ibtn" style={{fontSize:9}} onClick={()=>onAddSub(sec.id)}>+</button>
              <button className="tn-ibtn" style={{fontSize:9,opacity:.3}} onClick={()=>onDelSection(sec.id)}>✕</button>
            </div>
            <div style={{background:TN.bgDeep}}>
              {sec.subs.map(sb=>(
                <div key={sb.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",borderBottom:`1px solid ${TN.bgPanel}`}}>
                  <div onClick={()=>onToggleSub(sec.id,sb.id)} style={{width:12,height:12,borderRadius:2,border:`1.5px solid ${sb.done?color:TN.border}`,background:sb.done?color+"22":"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                    {sb.done&&<span style={{fontSize:7,color}}>✓</span>}
                  </div>
                  <span style={{flex:1,fontSize:10,color:sb.done?TN.fgDim:TN.fgMuted,textDecoration:sb.done?"line-through":"none"}}>{sb.title}</span>
                  <button className="tn-ibtn" style={{fontSize:8,opacity:.2}} onClick={()=>onDelSub(sec.id,sb.id)}>✕</button>
                </div>
              ))}
              {sec.subs.length===0&&<div style={{fontSize:9,color:TN.fgDim,padding:"7px 12px"}}>// no subtopics — click + to add</div>}
            </div>
          </div>
        );
      })}
      {item.sections.length===0&&<div style={{fontSize:9,color:TN.fgDim,marginBottom:8}}>// no sections yet</div>}
    </div>
  );
}

function SmallDateBox({label,date,color,days,highlight}){
  return (
    <div style={{background:TN.bgDeep,border:`1px solid ${highlight?TN.border2:TN.border}`,borderRadius:4,padding:"5px 7px"}}>
      <div style={{fontSize:6,color:TN.fgDim,letterSpacing:1.5,marginBottom:3}}>{label}</div>
      <div style={{fontSize:8,color,fontFamily:"'Fira Code',monospace",fontWeight:highlight?700:400}}>{date?new Date(date+"T00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</div>
      {days!=null&&date&&<div style={{fontSize:7,color:days<14?TN.red:days<30?TN.yellow:TN.fgDim,marginTop:2}}>{days===0?"today":days>0?days+"d":"past"}</div>}
    </div>
  );
}

// ── CALENDAR ───────────────────────────────────────────────────────────
function CalendarView({courses,certs,setDate}){
  const now=new Date();
  const [yr,setYr]=useState(now.getFullYear());
  const [mo,setMo]=useState(now.getMonth());
  const dim=new Date(yr,mo+1,0).getDate();
  const fdow=new Date(yr,mo,1).getDay();
  const mname=new Date(yr,mo).toLocaleString("default",{month:"long"});
  const isToday=d=>d===now.getDate()&&mo===now.getMonth()&&yr===now.getFullYear();

  const evts=d=>{
    const ds=`${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const r=[];
    courses.forEach(c=>{
      if(c.startDate===ds) r.push({color:c.color,name:c.name.split(" ")[0],label:"start"});
      if(c.endDate===ds)   r.push({color:TN.yellow,name:c.name.split(" ")[0],label:"end"});
    });
    certs.forEach(c=>{
      if(c.certStart===ds)  r.push({color:TN.cyan,  name:c.name.split(" ")[0],label:"enroll"});
      if(c.studyStart===ds) r.push({color:TN.fgMuted,name:c.name.split(" ")[0],label:"study"});
      if(c.studyEnd===ds)   r.push({color:TN.yellow, name:c.name.split(" ")[0],label:"end"});
      if(c.examDate===ds)   r.push({color:c.color,  name:c.name.split(" ")[0],label:"exam★"});
    });
    return r;
  };

  const upcoming=[];
  courses.forEach(c=>{
    [["startDate","start",c.color],["endDate","end",TN.yellow]].forEach(([f,l,col])=>{
      if(c[f]){const d=dLeft(c[f]);if(d!=null&&d>=0)upcoming.push({label:`${c.name} — course ${l}`,date:c[f],days:d,color:col,type:"course"});}
    });
  });
  certs.forEach(c=>{
    [["certStart","enrolled",TN.cyan],["studyStart","study start",TN.fgMuted],["studyEnd","study end",TN.yellow],["examDate","exam ★",""]].forEach(([f,l,col])=>{
      if(c[f]){const d=dLeft(c[f]);if(d!=null&&d>=0)upcoming.push({label:`${c.name} — ${l}`,date:c[f],days:d,color:col||c.color,type:"cert"});}
    });
  });
  upcoming.sort((a,b)=>a.days-b.days);
  const cells=[...Array(fdow).fill(null),...Array.from({length:dim},(_,i)=>i+1)];

  return (
    <div style={{maxWidth:900,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 300px",gap:16}}>
      <div className="tn-card" style={{padding:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <button className="tn-ibtn" style={{fontSize:20,padding:"0 8px"}} onClick={()=>{let m=mo-1,y=yr;if(m<0){m=11;y--;}setMo(m);setYr(y);}}>‹</button>
          <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:14,color:TN.fg}}>{mname} {yr}</div>
          <button className="tn-ibtn" style={{fontSize:20,padding:"0 8px"}} onClick={()=>{let m=mo+1,y=yr;if(m>11){m=0;y++;}setMo(m);setYr(y);}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d,i)=><div key={i} style={{fontSize:8,color:TN.fgDim,textAlign:"center"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {cells.map((d,i)=>{
            if(!d) return <div key={"b"+i}/>;
            const ev=evts(d),today=isToday(d);
            return (
              <div key={d} style={{minHeight:56,background:today?TN.bgPanel:TN.bgDeep,border:`1px solid ${today?TN.blue:TN.border}`,borderRadius:4,padding:"4px 5px",boxShadow:today?`0 0 8px ${TN.blue}33`:"none"}}>
                <div style={{fontSize:9,color:today?TN.blue:TN.fgDim,fontWeight:today?700:400,marginBottom:2}}>{d}</div>
                {ev.slice(0,2).map((e,ei)=>(
                  <div key={ei} style={{fontSize:7,background:e.color+"18",color:e.color,padding:"1px 4px",borderRadius:2,marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{e.name}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="tn-card">
          <div className="tn-label">upcoming</div>
          {upcoming.length===0?<div style={{fontSize:9,color:TN.fgDim}}>// no dates set</div>
          :upcoming.slice(0,9).map((e,i)=>(
            <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:`1px solid ${TN.bgPanel}`,alignItems:"center"}}>
              <div style={{width:3,alignSelf:"stretch",borderRadius:1,background:e.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:9,color:TN.fgMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.label}</div>
                <div style={{fontSize:7,color:TN.fgDim,marginTop:1,display:"flex",gap:5}}>
                  <span style={{fontFamily:"'Fira Code',monospace"}}>{e.date}</span>
                  <span style={{background:TN.bgPanel,padding:"0 4px",borderRadius:2,letterSpacing:.5}}>{e.type}</span>
                </div>
              </div>
              <div style={{fontSize:10,fontFamily:"'Fira Code',monospace",fontWeight:700,color:e.days===0?TN.green:e.days<7?TN.red:e.days<30?TN.yellow:TN.fgDim}}>{e.days===0?"now":e.days+"d"}</div>
            </div>
          ))}
        </div>

        <div className="tn-card" style={{overflow:"auto",maxHeight:340}}>
          <div className="tn-label">edit dates</div>
          {courses.map(c=>(
            <div key={c.id} style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:c.color}}/>
                <span style={{fontSize:9,color:c.color,fontFamily:"'Fira Code',monospace",fontWeight:700}}>{c.name}</span>
                <span style={{fontSize:7,color:TN.fgDim,background:TN.bgPanel,padding:"1px 5px",borderRadius:2,marginLeft:"auto"}}>course</span>
              </div>
              {[["startDate","start"],["endDate","end"]].map(([f,l])=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span style={{fontSize:7,color:TN.fgDim,minWidth:40}}>{l}</span>
                  <input type="date" className="tn-dinput" style={{flex:1}} value={c[f]||""} onChange={e=>setDate("course",c.id,f,e.target.value)}/>
                </div>
              ))}
            </div>
          ))}
          {certs.map(c=>(
            <div key={c.id} style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:c.color}}/>
                <span style={{fontSize:9,color:c.color,fontFamily:"'Fira Code',monospace",fontWeight:700}}>{c.name}</span>
                <span style={{fontSize:7,color:TN.fgDim,background:TN.bgPanel,padding:"1px 5px",borderRadius:2,marginLeft:"auto"}}>cert</span>
              </div>
              {[["certStart","enroll"],["studyStart","study"],["studyEnd","end"],["examDate","exam ★"]].map(([f,l])=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span style={{fontSize:7,color:TN.fgDim,minWidth:40}}>{l}</span>
                  <input type="date" className="tn-dinput" style={{flex:1}} value={c[f]||""} onChange={e=>setDate("cert",c.id,f,e.target.value)}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MODALS ─────────────────────────────────────────────────────────────
function TNModal({title,children,onClose,accent}){
  const ac=accent||TN.blue;
  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:TN.bgPopup,border:`1px solid ${ac}55`,borderRadius:8,padding:22,width:"100%",maxWidth:500,boxShadow:`0 0 40px ${ac}22,0 24px 60px #000`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:12,color:ac,letterSpacing:1}}>{title}</div>
          <button className="tn-ibtn" onClick={onClose} style={{fontSize:16}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MiniModal({title,ph,onClose,onAdd}){
  const [v,setV]=useState("");
  return (
    <TNModal title={title} onClose={onClose}>
      <input className="tn-input" placeholder={ph} value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&v.trim()&&onAdd(v.trim())} style={{marginBottom:16}} autoFocus/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="tn-gbtn" onClick={onClose}>cancel</button>
        <button className="tn-pbtn" style={{color:TN.green,borderColor:TN.green,background:TN.green+"15"}} onClick={()=>v.trim()&&onAdd(v.trim())}>add ✓</button>
      </div>
    </TNModal>
  );
}

function AddCourseModal({onClose,onAdd}){
  const [name,setName]=useState(""); const [provider,setProvider]=useState("");
  const [startDate,setStart]=useState(""); const [endDate,setEnd]=useState("");
  const [color,setColor]=useState(COURSE_COLORS[0]);
  return (
    <TNModal title="new course" onClose={onClose} accent={color}>
      <input className="tn-input" placeholder="Course name (e.g. Linux Fundamentals)" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:10}} autoFocus/>
      <input className="tn-input" placeholder="Provider (e.g. TryHackMe, Coursera)" value={provider} onChange={e=>setProvider(e.target.value)} style={{marginBottom:10}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[["START DATE",startDate,setStart],["END DATE",endDate,setEnd]].map(([l,v,sv])=>(
          <div key={l}><div className="tn-label" style={{marginBottom:3}}>{l}</div>
            <input type="date" className="tn-dinput" style={{width:"100%"}} value={v} onChange={e=>sv(e.target.value)}/></div>
        ))}
      </div>
      <div style={{marginBottom:18}}>
        <div className="tn-label" style={{marginBottom:5}}>color</div>
        <div style={{display:"flex",gap:6}}>
          {COURSE_COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:17,height:17,borderRadius:"50%",background:c,border:`2px solid ${color===c?"#fff":"transparent"}`,cursor:"pointer",boxShadow:color===c?`0 0 7px ${c}`:"none",transition:"all .15s"}}/>)}
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="tn-gbtn" onClick={onClose}>cancel</button>
        <button className="tn-pbtn" style={{color,borderColor:color,background:color+"15"}} onClick={()=>name.trim()&&onAdd({name,provider,startDate,endDate,color})}>create →</button>
      </div>
    </TNModal>
  );
}

function AddCertModal({onClose,onAdd}){
  const [name,setName]=useState(""); const [vendor,setVendor]=useState("");
  const [certStart,setCertStart]=useState(""); const [studyStart,setStudyStart]=useState("");
  const [studyEnd,setStudyEnd]=useState(""); const [examDate,setExamDate]=useState("");
  const [color,setColor]=useState(COURSE_COLORS[0]);
  return (
    <TNModal title="new certification" onClose={onClose} accent={TN.orange}>
      <input className="tn-input" placeholder="Cert name (e.g. AWS Solutions Architect)" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:10}} autoFocus/>
      <input className="tn-input" placeholder="Vendor (e.g. Amazon, CompTIA, Offensive Security)" value={vendor} onChange={e=>setVendor(e.target.value)} style={{marginBottom:10}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[["ENROLLMENT DATE",certStart,setCertStart],["STUDY START",studyStart,setStudyStart],["STUDY END",studyEnd,setStudyEnd],["EXAM DATE ★",examDate,setExamDate]].map(([l,v,sv])=>(
          <div key={l}><div className="tn-label" style={{marginBottom:3}}>{l}</div>
            <input type="date" className="tn-dinput" style={{width:"100%"}} value={v} onChange={e=>sv(e.target.value)}/></div>
        ))}
      </div>
      <div style={{marginBottom:18}}>
        <div className="tn-label" style={{marginBottom:5}}>color</div>
        <div style={{display:"flex",gap:6}}>
          {COURSE_COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:17,height:17,borderRadius:"50%",background:c,border:`2px solid ${color===c?"#fff":"transparent"}`,cursor:"pointer",boxShadow:color===c?`0 0 7px ${c}`:"none",transition:"all .15s"}}/>)}
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="tn-gbtn" onClick={onClose}>cancel</button>
        <button className="tn-pbtn" style={{color:TN.orange,borderColor:TN.orange,background:TN.orange+"15"}} onClick={()=>name.trim()&&onAdd({name,vendor,certStart,studyStart,studyEnd,examDate,color})}>add cert →</button>
      </div>
    </TNModal>
  );
}

function AddLabModal({platform,onClose,onAdd}){
  const [name,setName]=useState(""); const [diff,setDiff]=useState("easy"); const [os,setOs]=useState("Linux");
  if(!platform) return null;
  return (
    <TNModal title={`add lab — ${platform.name}`} onClose={onClose} accent={platform.color}>
      <input className="tn-input" placeholder="Lab / room / challenge name" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:12}} autoFocus/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <div>
          <div className="tn-label" style={{marginBottom:5}}>difficulty</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {DIFFICULTIES.map(d=><button key={d.key} onClick={()=>setDiff(d.key)} style={{fontSize:8,padding:"3px 8px",borderRadius:3,border:`1px solid ${diff===d.key?d.color:TN.border}`,background:diff===d.key?d.color+"18":"none",color:diff===d.key?d.color:TN.fgMuted,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>{d.label}</button>)}
          </div>
        </div>
        <div>
          <div className="tn-label" style={{marginBottom:5}}>os / type</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {["Linux","Windows","Web","Multi","Other"].map(o=><button key={o} onClick={()=>setOs(o)} style={{fontSize:8,padding:"3px 8px",borderRadius:3,border:`1px solid ${os===o?platform.color:TN.border}`,background:os===o?platform.color+"18":"none",color:os===o?platform.color:TN.fgMuted,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>{o}</button>)}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="tn-gbtn" onClick={onClose}>cancel</button>
        <button className="tn-pbtn" style={{color:platform.color,borderColor:platform.color,background:platform.color+"15"}} onClick={()=>name.trim()&&onAdd({name,diff,os,comp:"todo",writeup:"none"})}>add lab →</button>
      </div>
    </TNModal>
  );
}

function AddPlatformModal({onClose,onAdd,existingKeys}){
  const [name,setName]=useState(""); const [icon,setIcon]=useState("◆");
  const [color,setColor]=useState(PLATFORM_COLORS[3]);
  const [error,setError]=useState("");
  const key=name.trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  const handle=()=>{
    if(!name.trim()){setError("Platform name is required");return;}
    if(existingKeys.includes(key)){setError(`A platform with key "${key}" already exists`);return;}
    onAdd({key,name:name.trim(),icon,color});
  };
  return (
    <TNModal title="add platform" onClose={onClose} accent={color}>
      <div style={{marginBottom:12}}>
        <div className="tn-label" style={{marginBottom:4}}>PLATFORM NAME</div>
        <input className="tn-input" placeholder="e.g. VulnLab, PentesterLab, PortSwigger" value={name} onChange={e=>{setName(e.target.value);setError("");}} autoFocus/>
        {key&&<div style={{fontSize:8,color:TN.fgDim,marginTop:4}}>key: <span style={{fontFamily:"'Fira Code',monospace",color:TN.blue}}>{key}</span></div>}
        {error&&<div style={{fontSize:8,color:TN.red,marginTop:4}}>⚠ {error}</div>}
      </div>
      <div style={{marginBottom:12}}>
        <div className="tn-label" style={{marginBottom:5}}>ICON</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {PLATFORM_ICONS.map(ic=><div key={ic} onClick={()=>setIcon(ic)} style={{width:28,height:28,borderRadius:4,background:icon===ic?color+"22":TN.bgDeep,border:`1px solid ${icon===ic?color:TN.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,transition:"all .15s",color:icon===ic?color:TN.fgMuted}}>{ic}</div>)}
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <div className="tn-label" style={{marginBottom:5}}>COLOR</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {PLATFORM_COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,border:`2px solid ${color===c?"#fff":"transparent"}`,cursor:"pointer",boxShadow:color===c?`0 0 8px ${c}`:"none",transition:"all .15s"}}/>)}
        </div>
      </div>
      {/* Preview */}
      {name&&(
        <div style={{display:"flex",alignItems:"center",gap:8,background:TN.bgPanel,border:`1px solid ${color}44`,borderRadius:6,padding:"10px 14px",marginBottom:16}}>
          <span style={{fontSize:18,filter:`drop-shadow(0 0 5px ${color})`}}>{icon}</span>
          <div>
            <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:12,color}}>{name}</div>
            <div style={{fontSize:8,color:TN.fgDim,marginTop:1}}>0/0 pwned · 0 writeups</div>
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="tn-gbtn" onClick={onClose}>cancel</button>
        <button className="tn-pbtn" style={{color,borderColor:color,background:color+"15"}} onClick={handle}>add platform →</button>
      </div>
    </TNModal>
  );
}

function WriteupModal({lab,platform,onClose,onSave}){
  const [notes,setNotes]=useState(lab?.notes||"");
  const [url,setUrl]=useState(lab?.writeupUrl||"");
  const [completed,setCompleted]=useState(lab?.completed||"");
  const [urlErr,setUrlErr]=useState(false);
  if(!lab) return null;
  const ac=platform?.color||TN.blue;
  const handle=()=>{ if(url&&!validUrl(url)){setUrlErr(true);return;} onSave(notes,url,completed); };
  return (
    <TNModal title={`writeup — ${lab.name}`} onClose={onClose} accent={ac}>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <span style={{fontSize:8,padding:"2px 7px",borderRadius:3,background:(DIFFICULTIES.find(d=>d.key===lab.diff)||DIFFICULTIES[0]).color+"18",color:(DIFFICULTIES.find(d=>d.key===lab.diff)||DIFFICULTIES[0]).color}}>{(DIFFICULTIES.find(d=>d.key===lab.diff)||DIFFICULTIES[0]).label}</span>
        {lab.os&&<span style={{fontSize:8,padding:"2px 7px",borderRadius:3,background:TN.bgPanel,color:TN.fgMuted,border:`1px solid ${TN.border}`}}>{lab.os}</span>}
        {platform&&<span style={{fontSize:8,padding:"2px 7px",borderRadius:3,background:ac+"15",color:ac,border:`1px solid ${ac}33`}}>{platform.icon} {platform.name}</span>}
      </div>
      <div className="tn-label" style={{marginBottom:4}}>writeup url</div>
      <div style={{position:"relative",marginBottom:urlErr?4:10}}>
        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:11,pointerEvents:"none"}}>🔗</span>
        <input className="tn-input" placeholder="https://..." value={url} onChange={e=>{setUrl(e.target.value);setUrlErr(false);}} style={{paddingLeft:30,borderColor:urlErr?TN.red:""}}/>
      </div>
      {urlErr&&<div style={{fontSize:8,color:TN.red,marginBottom:8}}>⚠ enter a valid URL starting with http(s)://</div>}
      {url&&validUrl(url)&&(
        <a href={url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,background:TN.bgDeep,border:`1px solid ${TN.cyan}33`,borderRadius:4,padding:"5px 8px",marginBottom:10,textDecoration:"none",fontSize:9,color:TN.cyan}}>
          ↗ {url.replace(/^https?:\/\//,"")}
        </a>
      )}
      <div className="tn-label" style={{marginBottom:4}}>notes & methodology</div>
      <textarea className="tn-input" value={notes} onChange={e=>setNotes(e.target.value)}
        placeholder={"// notes, methodology, key commands...\n\n## Recon\n## Foothold\n## PrivEsc"}
        style={{height:150,resize:"vertical",lineHeight:1.7,marginBottom:10}}/>
      <div style={{marginBottom:16}}>
        <div className="tn-label" style={{marginBottom:3}}>completion date</div>
        <input type="date" className="tn-dinput" value={completed} onChange={e=>setCompleted(e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="tn-gbtn" onClick={onClose}>cancel</button>
        <button className="tn-pbtn" style={{color:ac,borderColor:ac,background:ac+"15"}} onClick={handle}>save ✓</button>
      </div>
    </TNModal>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────
function TNStyles(){
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&family=Fira+Code:wght@400;500;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:#16161e;}
    ::-webkit-scrollbar-thumb{background:#292e42;border-radius:2px;}
    ::-webkit-scrollbar-thumb:hover{background:#3b4261;}
    .tn-tab{background:none;border:none;border-bottom:2px solid transparent;color:#444b6a;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1.5px;padding:15px 13px 13px;cursor:pointer;transition:all .2s;}
    .tn-tab.active{color:#7aa2f7;border-bottom-color:#7aa2f7;}
    .tn-tab:not(.active):hover{color:#565f89;}
    .tn-card{background:#1f2335;border:1px solid #292e42;border-radius:6px;padding:14px;}
    .tn-scard{background:#1f2335;border:1px solid #292e42;border-radius:6px;padding:12px 14px;}
    .tn-cblock{background:#1f2335;border:1px solid #292e42;border-radius:6px;padding:14px;margin-bottom:10px;transition:border-color .2s;}
    .tn-labcard{background:#1f2335;border:1px solid #292e42;border-radius:6px;padding:14px;transition:border-color .2s,box-shadow .2s;}
    .tn-label{font-size:8px;color:#444b6a;letter-spacing:2px;margin-bottom:8px;font-family:'JetBrains Mono',monospace;}
    .tn-crow{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:4px;cursor:pointer;border:1px solid;transition:all .15s;margin-bottom:4px;}
    .tn-ibtn{background:none;border:none;cursor:pointer;color:#444b6a;font-size:12px;padding:2px 4px;transition:color .2s;font-family:inherit;line-height:1;}
    .tn-ibtn:hover{color:#c0caf5;}
    .tn-pbtn{background:none;border:1px solid #7aa2f7;color:#7aa2f7;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1px;padding:9px 18px;cursor:pointer;transition:all .2s;}
    .tn-pbtn:hover{opacity:.85;}
    .tn-gbtn{background:none;border:1px solid #292e42;color:#565f89;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:9px;padding:9px 16px;cursor:pointer;transition:all .2s;}
    .tn-gbtn:hover{border-color:#3b4261;color:#c0caf5;}
    .tn-xbtn{width:100%;background:none;border:1px solid #292e42;border-radius:4px;color:#444b6a;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1.5px;padding:6px;cursor:pointer;transition:all .2s;}
    .tn-xbtn:hover{border-color:#3b4261;color:#565f89;}
    .tn-ailbtn{background:none;border:1px solid #292e42;color:#444b6a;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1px;padding:3px 8px;cursor:pointer;transition:all .15s;}
    .tn-ailbtn:hover{border-color:#7aa2f755;color:#7aa2f7;}
    .tn-addcbtn{width:100%;background:none;border:1px dashed #292e42;border-radius:6px;color:#444b6a;padding:14px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;transition:all .2s;margin-top:6px;}
    .tn-addcbtn:hover{border-color:#7aa2f755;color:#7aa2f7;}
    .tn-input{background:#16161e;border:1px solid #292e42;border-radius:4px;color:#c0caf5;font-family:'JetBrains Mono',monospace;font-size:11px;padding:9px 11px;width:100%;outline:none;display:block;transition:border-color .2s;}
    .tn-input:focus{border-color:#7aa2f788;}
    .tn-dinput{background:#16161e;border:1px solid #292e42;border-radius:4px;color:#7aa2f7;font-family:'JetBrains Mono',monospace;font-size:9px;padding:6px 9px;outline:none;color-scheme:dark;transition:border-color .2s;}
    .tn-dinput:focus{border-color:#7aa2f788;}
    .tn-sbtn{font-size:7px;padding:2px 6px;border-radius:3px;border:1px solid;cursor:pointer;font-family:'JetBrains Mono',monospace;letter-spacing:.5px;transition:all .15s;}
    @keyframes tn-flash{0%,100%{background:#1a1b26;}50%{background:#2a1e16;}}
    .tn-flash{animation:tn-flash .7s 2;}
    @keyframes tn-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.3;transform:scale(.5);}}
    .tn-pulse{animation:tn-pulse 1.4s infinite;}
  `}</style>;
}
