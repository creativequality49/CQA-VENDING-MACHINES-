"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function Form(){
  const router=useRouter();const params=useSearchParams();
  const [mode,setMode]=useState<"login"|"signup">("signup");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [name,setName]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const next=(params.get("next")||"/fanxfantasy").startsWith("/")?(params.get("next")||"/fanxfantasy"):"/fanxfantasy";
  async function submit(e:FormEvent){e.preventDefault();setError("");setMessage("");setBusy(true);try{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";if(!url||!key)throw new Error("Fan account service is not configured.");
    const sb=createClient(url,key);
    if(mode==="signup"){
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{role:"fan",display_name:name||email.split("@")[0]},emailRedirectTo:`${window.location.origin}/fanxfantasy/auth?next=${encodeURIComponent(next)}`}});
      if(error)throw error;
      if(data.session){router.push(next);router.refresh();return;}
      setMessage("Check your email to verify your account, then return here to continue.");
    }else{
      const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;router.push(next);router.refresh();
    }
  }catch(e){setError(e instanceof Error?e.message:"Authentication failed.");}finally{setBusy(false)}}
  return <main style={{minHeight:"100vh",background:"#070708",color:"white",display:"grid",placeItems:"center",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}><section style={{width:"min(520px,100%)",border:"1px solid #2b2b32",borderRadius:24,padding:"clamp(24px,5vw,40px)",background:"#111115"}}><img src="/fanx/logo.png" alt="FanXFantasy" style={{width:180,maxHeight:64,objectFit:"contain",objectPosition:"left center",marginBottom:20}}/><p style={{color:"#ff2d8d",fontWeight:900,textTransform:"uppercase",letterSpacing:".12em",fontSize:12}}>Fan account</p><h1 style={{fontSize:"2rem",margin:"6px 0 8px"}}>{mode==="signup"?"Join free":"Welcome back"}</h1><p style={{color:"#aaaab5",lineHeight:1.6}}>Create a free account to follow creators. Payments and mature areas additionally require verified age assurance.</p><form onSubmit={submit} style={{display:"grid",gap:12}}>{mode==="signup"?<input value={name} onChange={e=>setName(e.target.value)} placeholder="Display name" style={input}/>:null}<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={input}/><input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" style={input}/>{error?<div style={alert}>{error}</div>:null}{message?<div style={{...alert,borderColor:"#285943",color:"#9df0c7"}}>{message}</div>:null}<button disabled={busy} style={button}>{busy?"Please wait…":mode==="signup"?"Create free account":"Log in"}</button></form><button onClick={()=>{setMode(mode==="signup"?"login":"signup");setError("");setMessage("")}} style={{background:"none",border:0,color:"#ff6da9",marginTop:18,cursor:"pointer"}}>{mode==="signup"?"Already have an account? Log in":"New to FanXFantasy? Join free"}</button><div style={{marginTop:20}}><Link href="/fanxfantasy" style={{color:"#aaaab5"}}>← Back to FanXFantasy</Link></div></section></main>
}
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"13px 14px",borderRadius:12,border:"1px solid #303038",background:"#0b0b0e",color:"white",font:"inherit"};const button:React.CSSProperties={border:0,borderRadius:999,padding:"14px 18px",background:"#ff2d8d",color:"white",fontWeight:900,cursor:"pointer"};const alert:React.CSSProperties={border:"1px solid #653047",borderRadius:12,padding:12,color:"#ff9dc2",background:"#1a0f14"};
export default function AuthPage(){return <Suspense><Form/></Suspense>}
