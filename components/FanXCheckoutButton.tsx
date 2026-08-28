"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Props = {
  kind: "subscription" | "product" | "post" | "tip";
  creatorSlug?: string;
  itemKey?: string;
  amountCents?: number;
  children: React.ReactNode;
  className?: string;
};

export default function FanXCheckoutButton({ kind, creatorSlug="scarlett-may", itemKey="", amountCents, children, className }: Props) {
  const router = useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function start(){
    setError("");setBusy(true);
    try{
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      if(!url||!key) throw new Error("Fan account login is not configured.");
      const supabase=createClient(url,key);
      const {data}=await supabase.auth.getSession();
      const token=data.session?.access_token;
      if(!token){
        const next=window.location.pathname;
        router.push(`/fanxfantasy/auth?next=${encodeURIComponent(next)}`);
        return;
      }
      const response=await fetch("/api/fanx/checkout",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({kind,creatorSlug,itemKey,amountCents})});
      const payload=await response.json().catch(()=>({}));
      if(response.status===403){router.push(`/age-check?returnTo=${encodeURIComponent(window.location.pathname)}`);return;}
      if(response.status===401){router.push(`/fanxfantasy/auth?next=${encodeURIComponent(window.location.pathname)}`);return;}
      if(!response.ok||!payload.url) throw new Error(payload.error||"Checkout could not start.");
      window.location.assign(payload.url);
    }catch(e){setError(e instanceof Error?e.message:"Checkout failed.");}
    finally{setBusy(false);}
  }

  return <span style={{display:"inline-grid",gap:6}}><button type="button" onClick={start} disabled={busy} className={className} style={!className?{border:0,borderRadius:999,padding:"11px 16px",background:"#ff2d8d",color:"white",fontWeight:900,cursor:"pointer"}:undefined}>{busy?"Opening checkout…":children}</button>{error?<small style={{color:"#ff91b8",maxWidth:260}}>{error}</small>:null}</span>;
}
