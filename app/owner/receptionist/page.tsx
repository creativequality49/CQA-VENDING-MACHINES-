"use client";
import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";
export default function ReceptionistPage() {
  const [message,setMessage] = useState("Checking owner access…");
  useEffect(() => {
    let active = true;
    const client = getBrowserSupabaseClient();
    const check = async () => {
      try {
        const {data} = await client.auth.getSession();
        if (!data.session) { if(active) setMessage("Sign in to your CQA owner account."); return; }
        const response = await fetch("/api/owner/receptionist", {cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token}});
        if(active) setMessage(response.ok ? "CallHand is pending provisioning. Calls are not enabled." : "Owner access unavailable.");
      } catch { if(active) setMessage("Owner access unavailable."); }
    };
    const {data:listener} = client.auth.onAuthStateChange(() => { if(active) setMessage("Checking owner access…"); });
    void check();
    return () => {active=false;listener.subscription.unsubscribe();};
  },[]);
  return <main style={{maxWidth:760,margin:"auto",padding:"2rem"}}><h1>CallHand AI Receptionist</h1><p>{message}</p><p>Call answering, job capture and owner SMS alerts. Activation requires verified setup.</p></main>;
}
