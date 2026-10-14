function SlabsTab({profile,showToast}){
  const C=DARK;
  const [materials,setMaterials]=uS([]);const [slabs,setSlabs]=uS([]);const [remnants,setRemnants]=uS([]);
  const [matFilt,setMatFilt]=uS("All");const [locFilt,setLocFilt]=uS("All");const [view,setView]=uS("slabs");
  const [editing,setEditing]=uS(null);const [remEditing,setRemEditing]=uS(null);const [loading,setLoading]=uS(true);

  async function load(){
    setLoading(true);
    const [m,s,r]=await Promise.all([
      sb.from("materials").select("id,name,sku,unit").eq("org_id",profile.org_id).is("deleted_at",null),
      sb.from("slabs").select("*").eq("org_id",profile.org_id).order("created_at",{ascending:false}),
      sb.from("remnants").select("*,materials(name,sku,unit)").eq("org_id",profile.org_id).order("created_at",{ascending:false}),
    ]);
    setMaterials(byName(m.data||[]));setSlabs(s.data||[]);setRemnants(r.data||[]);setLoading(false);
  }
  uE(()=>{load();},[profile.org_id]);

  const matName=id=>materials.find(m=>m.id===id)?.name||id;
  const filteredSlabs=slabs.filter(s=>(matFilt==="All"||s.material_id===matFilt)&&(locFilt==="All"||s.location===locFilt));
  const filteredRems=remnants.filter(r=>(matFilt==="All"||r.material_id===matFilt)&&(locFilt==="All"||r.location===locFilt));

  const statusColor={
    "In Stock":{bg:DARK.greenBg,c:DARK.green},
    "In Use":{bg:DARK.yellowBg,c:DARK.yellow},
    "Used":{bg:DARK.surface,c:DARK.muted},
    "Remnant":{bg:"#1a2a3a",c:"#5ab4f0"},
  };

  if(loading) return <div style={{textAlign:"center",marginTop:60,color:C.muted}}>Loading…</div>;

  return(
    <div style={{padding:"16px 24px"}}>
      <div className="row" style={{marginBottom:14,gap:8}}>
        <button className={"pill"+(view==="slabs"?" active":"")} onClick={()=>setView("slabs")}>Slabs ({slabs.length})</button>
        <button className={"pill"+(view==="remnants"?" active":"")} onClick={()=>setView("remnants")}>Remnants ({remnants.length})</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={()=>setEditing({})}>
          {view==="slabs"?"+ Add Slab":"+ Add Remnant"}
        </button>
      </div>

      <div className="row" style={{marginBottom:10,gap:6}}>
        <button className={"pill"+(locFilt==="All"?" active":"")} onClick={()=>setLocFilt("All")}>All Locations</button>
        {LOCATIONS.map(l=><button key={l} className={"pill"+(locFilt===l?" active":"")} onClick={()=>setLocFilt(l)}>{l}</button>)}
      </div>
      <div className="row" style={{marginBottom:14,gap:6,flexWrap:"wrap"}}>
        <button className={"pill"+(matFilt==="All"?" active":"")} onClick={()=>setMatFilt("All")}>All Materials</button>
        {materials.map(m=><button key={m.id} className={"pill"+(matFilt===m.id?" active":"")} onClick={()=>setMatFilt(m.id)} style={{fontSize:11}}>{m.name}</button>)}
      </div>

      {view==="slabs"&&(
        <div>
          {filteredSlabs.length===0&&<div style={{textAlign:"center",marginTop:40,color:C.muted}}>No slabs found. Add slabs to track individual pieces.</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
            {filteredSlabs.map(s=>{
              const sc=statusColor[s.status]||statusColor["In Stock"];
              return(
                <div key={s.id} className="card" style={{borderLeft:"3px solid "+sc.c}}>
                  <div className="row" style={{marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700}}>{matName(s.material_id)}</div>
                      <div className="mono muted" style={{fontSize:11}}>#{s.slab_number}</div>
                    </div>
                    <span className="tag" style={{background:sc.bg,color:sc.c}}>{s.status}</span>
                  </div>
                  {(s.width||s.height)&&<div className="muted" style={{fontSize:12,marginBottom:6}}>{s.width||"?"}″ × {s.height||"?"}″</div>}
                  <div className="muted" style={{fontSize:11,marginBottom:10}}>{s.location}{s.notes?` · ${s.notes}`:""}</div>
                  <div className="row" style={{gap:6}}>
                    <select value={s.status} onChange={async e=>{await sb.from("slabs").update({status:e.target.value}).eq("id",s.id);load();}} style={{flex:1,padding:"5px 8px",fontSize:11}}>
                      {["In Stock","In Use","Used","Remnant"].map(st=><option key={st}>{st}</option>)}
                    </select>
                    <button className="btn btn-ghost" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setEditing(s)}>Edit</button>
                    <button className="btn btn-danger" style={{fontSize:11,padding:"5px 10px"}} onClick={async()=>{await sb.from("slabs").delete().eq("id",s.id);load();}}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view==="remnants"&&(
        <div>
          {filteredRems.length===0&&<div style={{textAlign:"center",marginTop:40,color:C.muted}}>No remnants logged. Add remnants from leftover cuts.</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
            {filteredRems.map(r=>(
              <div key={r.id} className="card" style={{borderLeft:"3px solid #5ab4f0"}}>
                <div style={{fontWeight:700,marginBottom:4}}>{r.materials?.name||"Unknown"}</div>
                <div className="muted" style={{fontSize:12,marginBottom:4}}>{r.width}″ × {r.height}″ = {(r.width*r.height/144).toFixed(1)} sqft</div>
                <div className="muted" style={{fontSize:11,marginBottom:8}}>{r.location}{r.notes?` · ${r.notes}`:""}</div>
                <button className="btn btn-danger" style={{fontSize:11,padding:"5px 10px",width:"100%"}} onClick={async()=>{await sb.from("remnants").delete().eq("id",r.id);load();}}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing&&view==="slabs"&&<SlabModal profile={profile} slab={editing.id?editing:null} materials={materials} onClose={()=>setEditing(null)} onDone={()=>{load();setEditing(null);}} showToast={showToast}/>}
      {editing&&view==="remnants"&&<RemnantModal profile={profile} materials={materials} onClose={()=>setEditing(null)} onDone={()=>{load();setEditing(null);}} showToast={showToast}/>}
    </div>
  );
}

function SlabModal({profile,slab,materials,onClose,onDone,showToast}){
  const [f,setF]=uS(slab||{material_id:"",location:"Charleston",slab_number:"",width:"",height:"",status:"In Stock",notes:""});
  const [busy,setBusy]=uS(false);const [err,setErr]=uS("");

  async function submit(){
    if(!f.material_id||!f.slab_number.trim()){setErr("Material and slab number required");return;}
    setBusy(true);
    try{
      if(slab){await sb.from("slabs").update({material_id:f.material_id,location:f.location,slab_number:f.slab_number.trim(),width:parseFloat(f.width)||null,height:parseFloat(f.height)||null,status:f.status,notes:f.notes||null}).eq("id",slab.id);}
      else{await sb.from("slabs").insert({org_id:profile.org_id,material_id:f.material_id,location:f.location,slab_number:f.slab_number.trim(),width:parseFloat(f.width)||null,height:parseFloat(f.height)||null,status:f.status,notes:f.notes||null});}
      showToast(slab?"Updated":"Slab added");onDone();
    }catch(e){setErr(e.message);}setBusy(false);
  }

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>{slab?"Edit Slab":"Add Slab"}</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div className="section"><div className="lbl">Material</div><select value={f.material_id} onChange={e=>setF({...f,material_id:e.target.value})}><option value="">— Select —</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}</select></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><div className="lbl">Location</div><select value={f.location} onChange={e=>setF({...f,location:e.target.value})}>{LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></div>
          <div><div className="lbl">Slab #</div><input value={f.slab_number} onChange={e=>setF({...f,slab_number:e.target.value})} placeholder="e.g. A-01"/></div>
          <div><div className="lbl">Width (inches)</div><input type="number" value={f.width} onChange={e=>setF({...f,width:e.target.value})}/></div>
          <div><div className="lbl">Height (inches)</div><input type="number" value={f.height} onChange={e=>setF({...f,height:e.target.value})}/></div>
        </div>
        <div className="section"><div className="lbl">Status</div><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{["In Stock","In Use","Used","Remnant"].map(s=><option key={s}>{s}</option>)}</select></div>
        <div className="section"><div className="lbl">Notes</div><input value={f.notes||""} onChange={e=>setF({...f,notes:e.target.value})}/></div>
        {err&&<div style={{color:DARK.red,fontSize:12,marginBottom:10}}>{err}</div>}
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={submit}>{busy?"Saving…":slab?"Save":"Add slab"}</button>
      </div>
    </div>
  );
}

function RemnantModal({profile,materials,onClose,onDone,showToast}){
  const [f,setF]=uS({material_id:"",location:"Charleston",width:"",height:"",notes:""});
  const [busy,setBusy]=uS(false);const [err,setErr]=uS("");

  async function submit(){
    if(!f.material_id||!f.width||!f.height){setErr("Material, width and height required");return;}
    setBusy(true);
    try{
      await sb.from("remnants").insert({org_id:profile.org_id,material_id:f.material_id,location:f.location,width:parseFloat(f.width),height:parseFloat(f.height),notes:f.notes||null});
      showToast("Remnant logged");onDone();
    }catch(e){setErr(e.message);}setBusy(false);
  }

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>Log Remnant</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div className="section"><div className="lbl">Material</div><select value={f.material_id} onChange={e=>setF({...f,material_id:e.target.value})}><option value="">— Select —</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div className="section"><div className="lbl">Location</div><select value={f.location} onChange={e=>setF({...f,location:e.target.value})}>{LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><div className="lbl">Width (inches)</div><input type="number" value={f.width} onChange={e=>setF({...f,width:e.target.value})}/></div>
          <div><div className="lbl">Height (inches)</div><input type="number" value={f.height} onChange={e=>setF({...f,height:e.target.value})}/></div>
        </div>
        {f.width&&f.height&&<div className="muted" style={{fontSize:12,marginBottom:12}}>= {(parseFloat(f.width)*parseFloat(f.height)/144).toFixed(2)} sqft</div>}
        <div className="section"><div className="lbl">Notes</div><input value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></div>
        {err&&<div style={{color:DARK.red,fontSize:12,marginBottom:10}}>{err}</div>}
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={submit}>{busy?"Saving…":"Log remnant"}</button>
      </div>
    </div>
  );
}
