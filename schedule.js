function ScheduleTab({profile,showToast}){
  const C=DARK;
  const [jobs,setJobs]=uS([]);const [clients,setClients]=uS([]);const [materials,setMaterials]=uS([]);const [jobMats,setJobMats]=uS([]);const [profiles,setProfiles]=uS([]);const [photos,setPhotos]=uS([]);
  const [sfilt,setSfilt]=uS("All");const [lfilt,setLfilt]=uS("All");const [expanded,setExpanded]=uS(null);const [editing,setEditing]=uS(null);const [photoJob,setPhotoJob]=uS(null);const [loading,setLoading]=uS(true);

  async function load(){
    setLoading(true);
    const [j,c,m,jm,p,ph]=await Promise.all([
      sb.from("jobs").select("*").eq("org_id",profile.org_id).is("deleted_at",null).neq("status","Complete"),
      sb.from("clients").select("id,name,phone").eq("org_id",profile.org_id),
      sb.from("materials").select("id,name,sku,unit").eq("org_id",profile.org_id).is("deleted_at",null),
      sb.from("job_materials").select("*"),
      sb.from("profiles").select("id,full_name").eq("org_id",profile.org_id),
      sb.from("job_photos").select("*").eq("org_id",profile.org_id),
    ]);
    setJobs(j.data||[]);setClients(c.data||[]);setMaterials(byName(m.data||[]));setJobMats(jm.data||[]);setProfiles(p.data||[]);setPhotos(ph.data||[]);setLoading(false);
  }
  uE(()=>{load();},[profile.org_id]);

  const filtered=jobs.filter(j=>(sfilt==="All"||j.status===sfilt)&&(lfilt==="All"||j.location===lfilt));
  const grouped=filtered.reduce((acc,j)=>{const key=j.job_date||"";(acc[key]=acc[key]||[]).push(j);return acc;},{});

  function matsFor(jobId){return jobMats.filter(jm=>jm.job_id===jobId).map(jm=>{const mat=materials.find(m=>m.id===jm.material_id);return{...jm,mat,name:mat?.name||jm.material_id,stock:0};});}
  function photosFor(jobId){return photos.filter(p=>p.job_id===jobId);}

  function printCutSheet(job){
    const mats=matsFor(job.id);const client=clients.find(c=>c.id===job.client_id);const assignee=profiles.find(p=>p.id===job.assigned_to);
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Cut Sheet — ${job.name}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:30px auto;color:#222}h1{font-size:20px;color:#d4642a;margin-bottom:4px}h2{font-size:15px;color:#555;font-weight:400;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}.info-box{background:#f9f9f9;border:1px solid #ddd;border-radius:8px;padding:12px}.info-box label{font-size:10px;font-weight:700;text-transform:uppercase;color:#888;display:block;margin-bottom:3px}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#f0f0f0;padding:9px 10px;text-align:left;border-bottom:2px solid #ccc;font-size:13px}td{padding:9px 10px;border-bottom:1px solid #eee;font-size:13px}.notes{margin-top:20px;padding:14px;border:1px solid #ddd;border-radius:8px;background:#fffef0}.sig{margin-top:40px;display:flex;gap:40px}.sig-line{flex:1;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#888}@media print{body{margin:10px}}</style></head><body>
    <h1>Cut Sheet — ${job.name}</h1>
    <h2>Superior Stone of the Southeast</h2>
    <div class="grid">
      <div class="info-box"><label>Date</label><b>${job.job_date?new Date(job.job_date+"T12:00:00").toLocaleDateString():"-"}</b></div>
      <div class="info-box"><label>Location</label><b>${job.location||"-"}</b></div>
      <div class="info-box"><label>Client</label><b>${client?client.name:job.details||"-"}</b>${client?.phone?`<br/><small>${client.phone}</small>`:""}</div>
      <div class="info-box"><label>Assigned to</label><b>${assignee?.full_name||"Unassigned"}</b></div>
    </div>
    <table><thead><tr><th>Material</th><th>SKU</th><th>Required</th><th>Unit</th><th>Notes</th></tr></thead><tbody>
    ${mats.map(m=>`<tr><td>${m.name}</td><td style="font-family:monospace;font-size:11px">${m.mat?.sku||"-"}</td><td>${m.required}</td><td>${m.mat?.unit||"sqft"}</td><td>${m.notes||""}</td></tr>`).join("")}
    </tbody></table>
    ${job.details?`<div class="notes"><b>Notes:</b> ${job.details}</div>`:""}
    <div class="sig">
      <div class="sig-line">Fabricator signature &amp; date</div>
      <div class="sig-line">QC check</div>
      <div class="sig-line">Delivery / Install</div>
    </div>
    </body></html>`);
    w.document.close();w.print();
  }

  if(loading) return <div style={{textAlign:"center",marginTop:60,color:C.muted}}>Loading…</div>;

  return(
    <div style={{padding:"16px 24px"}}>
      <div className="row" style={{marginBottom:10,gap:6}}>
        {["All",...STATUSES.filter(s=>s!=="Complete")].map(s=><button key={s} className={"pill"+(sfilt===s?" active":"")} onClick={()=>setSfilt(s)}>{s}</button>)}
      </div>
      <div className="row" style={{marginBottom:18,gap:6}}>
        {["All",...LOCATIONS].map(l=><button key={l} className={"pill"+(lfilt===l?" active":"")} onClick={()=>setLfilt(l)}>{l==="All"?"All Locations":l}</button>)}
      </div>

      {Object.keys(grouped).sort().map(date=>(
        <div key={date} style={{marginBottom:24}}>
          <div style={{color:C.orange,fontWeight:700,fontSize:14,marginBottom:10}}>{date?fmtDate(date):"No date set"}</div>
          {grouped[date].map(job=>{
            const mats=matsFor(job.id);const shortage=mats.some(m=>m.required>0);const isOpen=expanded===job.id;
            const assignee=profiles.find(p=>p.id===job.assigned_to);const client=clients.find(c=>c.id===job.client_id);const jPhotos=photosFor(job.id);
            const lc=locColor(job.location,C);
            return(
              <div key={job.id} className="card" style={{marginBottom:8,padding:0,borderLeft:"3px solid "+C.orange,border:"1px solid "+C.border}}>
                <div className="row" style={{padding:"14px 18px",cursor:"pointer"}} onClick={()=>setExpanded(isOpen?null:job.id)}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15}}>{job.name}</div>
                    <div className="muted" style={{fontSize:12,marginTop:3,display:"flex",gap:12,flexWrap:"wrap"}}>
                      {client&&<span>👤 {client.name}</span>}
                      {job.job_time&&<span>⏰ {job.job_time}</span>}
                      {job.location&&<span className="tag" style={{background:lc.bg,color:lc.c}}>{job.location}</span>}
                      {assignee&&<span>👷 {assignee.full_name}</span>}
                      {jPhotos.length>0&&<span>📷 {jPhotos.length}</span>}
                    </div>
                  </div>
                  <span style={{fontSize:11,background:C.surface,padding:"3px 9px",borderRadius:999,border:"1px solid "+C.border,color:C.muted,marginRight:8}}>{job.status}</span>
                  <span className="muted">{isOpen?"▲":"▼"}</span>
                </div>

                {isOpen&&(
                  <div style={{borderTop:"1px solid "+C.border,padding:"14px 18px"}}>
                    <div className="row" style={{marginBottom:14,justifyContent:"flex-end",gap:8}}>
                      <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setEditing(job)}>Edit</button>
                      <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>printCutSheet(job)}>🖨 Cut Sheet</button>
                      <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setPhotoJob(job)}>📷 Photos {jPhotos.length>0?"("+jPhotos.length+")":""}</button>
                    </div>

                    {/* Materials */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:12}}>
                      {mats.map(m=>(
                        <div key={m.id} style={{background:C.surface,borderRadius:10,padding:"12px 14px",border:"1px solid "+C.border}}>
                          <div style={{fontWeight:700,fontSize:13}}>{m.name}</div>
                          <div className="mono muted" style={{fontSize:11,marginBottom:6}}>{m.mat?.sku}</div>
                          <div className="row" style={{fontSize:12}}>
                            <span className="muted">Need: <b style={{color:C.text}}>{m.required}</b></span>
                            {m.notes&&<span className="muted" style={{fontStyle:"italic",fontSize:11}}>{m.notes}</span>}
                          </div>
                          <div className="row" style={{marginTop:8,gap:6}}>
                            <input type="number" defaultValue={m.required} onBlur={async e=>{const v=parseFloat(e.target.value)||0;await sb.from("job_materials").update({required:v}).eq("id",m.id);}} style={{width:70,padding:"4px 8px",fontSize:12}}/>
                            <span className="muted" style={{fontSize:11}}>{m.mat?.unit||"sqft"}</span>
                            <button onClick={async()=>{await sb.from("job_materials").delete().eq("id",m.id);load();}} className="btn btn-danger" style={{marginLeft:"auto",fontSize:11,padding:"3px 8px"}}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add material */}
                    <AddMatRowSchedule jobId={job.id} materials={materials} onDone={load} showToast={showToast}/>

                    {/* Status actions */}
                    <div className="row" style={{marginTop:12,flexWrap:"wrap"}}>
                      {STATUSES.filter(s=>s!==job.status).map(s=>(
                        <button key={s} className="btn btn-ghost" style={{fontSize:12}} onClick={async()=>{
                          if(s==="Complete"){await sb.from("jobs").update({status:"Complete",completed_at:new Date().toISOString()}).eq("id",job.id);showToast("Job completed");}
                          else{await sb.from("jobs").update({status:s}).eq("id",job.id);showToast("Marked "+s);}
                          await logActivity(profile.org_id,profile.id,"Job status",job.name+" → "+s);load();
                        }}>Mark {s}</button>
                      ))}
                      <button className="btn btn-danger" style={{marginLeft:"auto",fontSize:12}} onClick={async()=>{await sb.from("jobs").update({deleted_at:new Date().toISOString()}).eq("id",job.id);showToast("Deleted");load();}}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {filtered.length===0&&<div style={{textAlign:"center",marginTop:80,color:C.muted}}><div style={{fontSize:16,fontWeight:600,marginBottom:6}}>No jobs yet.</div><div style={{fontSize:13}}>Tap + to add one.</div></div>}

      {editing&&<JobModal profile={profile} job={editing.id?editing:null} clients={clients} profiles={profiles} onClose={()=>setEditing(null)} onDone={()=>{load();setEditing(null);}} showToast={showToast}/>}
      {photoJob&&<PhotoModal profile={profile} job={photoJob} photos={photos.filter(p=>p.job_id===photoJob.id)} onClose={()=>setPhotoJob(null)} onDone={load} showToast={showToast}/>}
    </div>
  );
}

function AddMatRowSchedule({jobId,materials,onDone,showToast}){
  const C=DARK;
  const [search,setSearch]=uS("");const [sel,setSel]=uS("");const [qty,setQty]=uS("");const [notes,setNotes]=uS("");
  const filt=search.trim()?materials.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.sku.toLowerCase().includes(search.toLowerCase())):materials;

  async function add(){
    if(!sel||!qty)return;
    await sb.from("job_materials").insert({job_id:jobId,material_id:sel,required:parseFloat(qty)||0,notes:notes||null});
    setSel("");setSearch("");setQty("");setNotes("");showToast("Material added");onDone();
  }
  return(
    <div style={{background:C.bg,borderRadius:9,padding:"12px 14px",border:"1px dashed "+C.border,marginBottom:8}}>
      <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Add Material</div>
      <div className="row" style={{flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:"1 1 200px"}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setSel("");}} placeholder="Search…" style={{marginBottom:6,padding:"8px 10px",fontSize:13}}/>
          <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:"8px 10px",fontSize:13}}>
            <option value="">{filt.length?"Select ("+filt.length+")":"No matches"}</option>
            {filt.map(m=><option key={m.id} value={m.id}>{m.sku} — {m.name}</option>)}
          </select>
        </div>
        <input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Qty" style={{width:80,padding:"8px 10px",fontSize:13}}/>
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes" style={{flex:1,minWidth:100,padding:"8px 10px",fontSize:13}}/>
        <button className="btn btn-primary" disabled={!sel||!qty} onClick={add}>+ Add</button>
      </div>
    </div>
  );
}

function JobModal({profile,job,clients,profiles,onClose,onDone,showToast}){
  const C=DARK;
  const [f,setF]=uS(job?{name:job.name,details:job.details||"",status:job.status,fab_status:job.fab_status||"Queued",location:job.location||"Charleston",job_date:job.job_date||"",job_time:job.job_time||"9:00 AM",assigned_to:job.assigned_to||"",client_id:job.client_id||""}:{name:"",details:"",status:"Scheduled",fab_status:"Queued",location:"Charleston",job_date:"",job_time:"9:00 AM",assigned_to:"",client_id:""});
  const [busy,setBusy]=uS(false);const [err,setErr]=uS("");

  async function submit(){
    if(!f.name.trim()||!f.job_date){setErr("Name and date required");return;}
    setBusy(true);
    try{
      const payload={name:f.name.trim(),details:f.details||null,status:f.status,fab_status:f.fab_status,location:f.location,job_date:f.job_date,job_time:f.job_time||null,assigned_to:f.assigned_to||null,client_id:f.client_id||null};
      if(job){await sb.from("jobs").update(payload).eq("id",job.id);showToast("Job updated");}
      else{await sb.from("jobs").insert({...payload,org_id:profile.org_id});showToast("Job created");}
      await logActivity(profile.org_id,profile.id,job?"Job edited":"Job created",f.name);onDone();
    }catch(e){setErr(e.message);}setBusy(false);
  }

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>{job?"Edit Job":"New Job"}</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div className="section"><div className="lbl">Job name</div><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Marriott Lobby Phase 2"/></div>
        <div className="section"><div className="lbl">Details / scope</div><textarea rows={3} value={f.details} onChange={e=>setF({...f,details:e.target.value})} style={{width:"100%",resize:"vertical"}}/></div>
        <div className="section"><div className="lbl">Client</div><select value={f.client_id} onChange={e=>setF({...f,client_id:e.target.value})}><option value="">— None —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="section"><div className="lbl">Location</div>
          <div className="row" style={{gap:8}}>
            {LOCATIONS.map(l=><button key={l} onClick={()=>setF({...f,location:l})} style={{flex:1,padding:"9px",borderRadius:8,cursor:"pointer",border:"1.5px solid "+(f.location===l?DARK.orange:DARK.border),background:f.location===l?DARK.surface:"transparent",color:f.location===l?DARK.orange:DARK.muted,fontWeight:700,fontSize:13}}>{l}</button>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><div className="lbl">Date</div><input type="date" value={f.job_date} onChange={e=>setF({...f,job_date:e.target.value})}/></div>
          <div><div className="lbl">Time</div><input value={f.job_time} onChange={e=>setF({...f,job_time:e.target.value})} placeholder="9:00 AM"/></div>
          <div><div className="lbl">Status</div><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><div className="lbl">Fab status</div><select value={f.fab_status} onChange={e=>setF({...f,fab_status:e.target.value})}>{FAB_STATS.map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="section"><div className="lbl">Assigned to</div><select value={f.assigned_to} onChange={e=>setF({...f,assigned_to:e.target.value})}><option value="">— Unassigned —</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
        {err&&<div style={{color:DARK.red,fontSize:12,marginBottom:10}}>{err}</div>}
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={submit}>{busy?"Saving…":job?"Save changes":"Create job"}</button>
      </div>
    </div>
  );
}

function PhotoModal({profile,job,photos,onClose,onDone,showToast}){
  const C=DARK;const [uploading,setUploading]=uS(false);const [caption,setCaption]=uS("");const [urls,setUrls]=uS({});
  const {session}=useAuth();

  uE(()=>{
    photos.forEach(async p=>{const {data}=await sb.storage.from("job-photos").createSignedUrl(p.file_path,3600);if(data)setUrls(u=>({...u,[p.id]:data.signedUrl}));});
  },[photos]);

  async function upload(f){
    if(!f||!session)return;setUploading(true);
    try{
      const ext=f.name.split(".").pop()||"jpg";const path=`${session.user.id}/${job.id}_${Date.now()}.${ext}`;
      const {error}=await sb.storage.from("job-photos").upload(path,f,{contentType:f.type});
      if(error)throw error;
      await sb.from("job_photos").insert({job_id:job.id,org_id:profile.org_id,file_path:path,caption:caption||null});
      showToast("Photo added");setCaption("");onDone();
    }catch(e){showToast("Upload failed: "+e.message);}setUploading(false);
  }

  async function deletePhoto(photo){await sb.storage.from("job-photos").remove([photo.file_path]);await sb.from("job_photos").delete().eq("id",photo.id);showToast("Photo deleted");onDone();}

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>Photos — {job.name}</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div style={{marginBottom:16}}>
          <div className="lbl">Add photo</div>
          <input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Caption (optional)" style={{marginBottom:8}}/>
          <div className="row" style={{gap:8}}>
            <label style={{flex:1,background:uploading?C.surface:C.orange,color:uploading?C.muted:"#fff",borderRadius:9,padding:"11px",fontWeight:700,fontSize:14,cursor:uploading?"default":"pointer",textAlign:"center",display:"block"}}>
              {uploading?"Uploading…":"📷 Take / Choose Photo"}
              <input type="file" accept="image/*" disabled={uploading} style={{display:"none"}} onChange={e=>{if(e.target.files[0])upload(e.target.files[0]);e.target.value="";}}/>
            </label>
          </div>
        </div>
        {photos.length===0&&<div className="muted" style={{textAlign:"center",padding:"20px 0"}}>No photos yet.</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          {photos.map(p=>(
            <div key={p.id} style={{position:"relative"}}>
              {urls[p.id]?<img src={urls[p.id]} alt={p.caption||""} style={{width:"100%",height:140,objectFit:"cover",borderRadius:8,display:"block"}}/>:<div style={{width:"100%",height:140,background:C.surface,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>Loading…</div>}
              {p.caption&&<div style={{fontSize:11,color:C.muted,marginTop:4,paddingLeft:2}}>{p.caption}</div>}
              <button onClick={()=>deletePhoto(p)} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.6)",border:"none",color:"#fff",borderRadius:"50%",width:24,height:24,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
