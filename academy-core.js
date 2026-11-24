(() => {
  const SUPABASE_URL = "https://vmubnpnhmfljpgehogai.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e2nUv2WnEyEvroA68ByXmw_55SajdIA";
  const client = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
  window.zbaClient = client;
  const show = (id, message) => { const el = document.getElementById(id); if (el) el.textContent = message; };
  let activeStudentUserId = "";
  let studentTabToken = "";
  try {
    studentTabToken = sessionStorage.getItem("zba_student_tab_token") || (Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
    sessionStorage.setItem("zba_student_tab_token",studentTabToken);
  } catch (_) { studentTabToken = "tab-"+Date.now(); }
  const studentSessionKey = "zba_active_student_tab";
  function claimStudentTab(user) {
    if(!user || user.email?.toLowerCase()==="rajulmoviehub@gmail.com") return;
    activeStudentUserId=user.id;
    try {
      localStorage.setItem(studentSessionKey,JSON.stringify({userId:user.id,token:studentTabToken,at:Date.now()}));
      const notice=document.getElementById("studentProtectionNotice");
      if(notice){notice.style.display="block";notice.textContent="⚠️ PERSONAL ACCOUNT PROTECTION — This student account is active in this browser tab. Signing in on another tab in this same browser signs out the earlier tab. Other devices may still be able to sign in; full cross-device session enforcement requires server-side authentication controls.";}
    } catch (_) {}
  }
  // Do not sign out a user when another browser tab claims the same account.
  // Supabase shares one persisted session across tabs; signing out here would
  // also invalidate the newly signed-in tab and create a login loop.
  async function renderStudentProtection(user,application){
    const name=application?.passport_name||user.user_metadata?.full_name||"Student";
    const email=user.email||"";
    const id=String(user.id||"").slice(0,12);
    user.__academyStudentName=name;
    const stamp="ZAFAR BINARY ACADEMY • "+name+" • "+email+" • STUDENT "+id;
    const mark=document.getElementById("studentSecurityWatermark");
    if(mark) mark.textContent=stamp+"\n"+stamp;
    const notice=document.getElementById("studentProtectionNotice");
    if(notice) notice.style.display="block";
    const dashboard=document.getElementById("studentDashboard");
    if(dashboard) dashboard.classList.add("protected-content");
    claimStudentTab(user);
  }
  async function openWatermarkedStudentFile(path,user){
    const popup=window.open("about:blank","_blank");
    try{
      const signedUrl=await signedExamLink(path);
      const response=await fetch(signedUrl);
      if(!response.ok) throw new Error("Protected file could not be retrieved.");
      const sourceBlob=await response.blob();
      const identity=(user.__academyStudentName||user.user_metadata?.full_name||"Student")+" • "+(user.email||"")+" • "+String(user.id||"").slice(0,12);
      let outputBlob;
      if(sourceBlob.type==="application/pdf" || /\.pdf$/i.test(path)){
        if(!window.PDFLib) throw new Error("The secure PDF watermark service did not load. Please try again later.");
        const {PDFDocument,StandardFonts,rgb,degrees}=window.PDFLib;
        const pdf=await PDFDocument.load(await sourceBlob.arrayBuffer());
        const font=await pdf.embedFont(StandardFonts.HelveticaBold);
        for(const page of pdf.getPages()){
          const size=page.getSize();
          const label="ZAFAR BINARY ACADEMY - COPY FOR "+identity.replace(/[^\\x20-\\x7E]/g," ").slice(0,150);
          for(const y of [size.height*.28,size.height*.58]){
            page.drawText(label,{x:18,y,font,size:Math.max(10,Math.min(19,size.width/38)),color:rgb(.72,.12,.12),opacity:.24,rotate:degrees(28),maxWidth:size.width*1.3});
          }
        }
        outputBlob=new Blob([await pdf.save()],{type:"application/pdf"});
      }else if(/^image\//.test(sourceBlob.type) || /\.(png|jpe?g)$/i.test(path)){
        const objectUrl=URL.createObjectURL(sourceBlob);
        const imageElement=new Image();
        await new Promise((resolve,reject)=>{imageElement.onload=resolve;imageElement.onerror=reject;imageElement.src=objectUrl;});
        const canvas=document.createElement("canvas");
        canvas.width=imageElement.naturalWidth;canvas.height=imageElement.naturalHeight;
        const ctx=canvas.getContext("2d");ctx.drawImage(imageElement,0,0);
        ctx.save();ctx.globalAlpha=.32;ctx.fillStyle="#b51f2b";ctx.font="bold "+Math.max(18,Math.round(canvas.width/38))+"px Arial";ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(-Math.PI/7);
        for(let y=-canvas.height;y<canvas.height*1.5;y+=Math.max(90,canvas.height/3))ctx.fillText("ZAFAR ACADEMY • "+identity,-canvas.width,y);
        ctx.restore();URL.revokeObjectURL(objectUrl);
        outputBlob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
        if(!outputBlob)throw new Error("Could not watermark this image.");
      }else throw new Error("This file type is not supported by protected viewing.");
      const protectedUrl=URL.createObjectURL(outputBlob);
      if(popup && !popup.closed){popup.location.href=protectedUrl;}
      else{
        const link=document.createElement("a");link.href=protectedUrl;link.download=(path.split("/").pop()||"academy-paper").replace(/\.(pdf|jpe?g|png)$/i,"")+(outputBlob.type==="application/pdf"?"-watermarked.pdf":"-watermarked.png");
        document.body.appendChild(link);link.click();link.remove();
      }
      setTimeout(()=>URL.revokeObjectURL(protectedUrl),10*60*1000);
    }catch(error){
      if(popup && !popup.closed)popup.close();
      alert((error.message||"Could not open protected file.")+" The original unwatermarked file was not opened.");
    }
  }
  document.addEventListener("contextmenu",event=>{
    if(event.target.closest("#studentDashboard")) event.preventDefault();
  });
  document.addEventListener("copy",event=>{
    if(event.target.closest("#studentDashboard")){event.preventDefault();show("studentProtectionNotice","Copying protected student-area content is disabled. Please use your own notes; do not redistribute academy materials.");}
  });
  document.addEventListener("keydown",event=>{
    if(!event.target.closest("#studentDashboard"))return;
    const key=String(event.key||"").toLowerCase();
    if((event.ctrlKey||event.metaKey)&&["p","s","u"].includes(key)){event.preventDefault();show("studentProtectionNotice","Printing, saving the page and viewing source are restricted in the student area. Screenshots and external recording cannot be reliably blocked.");}
  });
   async function recordRuleEvent(code,details){
     try{const {data,error}=await client.rpc("record_academy_rule_event",{p_event_code:code,p_details:details||""});if(error||!data)return;
       const n=document.getElementById("disciplineNotice");if(!n)return;n.style.display="block";
       if(data.level==="review"){document.body.classList.add("academy-review-mode");n.className="academy-review-warning";n.textContent="ACCOUNT UNDER REVIEW — Repeated exam-rule events ("+data.count+"). This is not an automatic suspension. Contact academy support for review.";}
       else{n.className="warning";n.textContent="⚠️ ACADEMY RULE REMINDER — "+data.message+" Your account remains active.";}
     }catch(e){console.warn("Rule monitor unavailable",e);}
   }
   async function loadRuleNotice(){
     try{const {data,error}=await client.from("academy_rule_events").select("event_code,created_at").order("created_at",{ascending:false}).limit(10);if(error||!data?.length)return;
       const recent=data.filter(x=>Date.now()-new Date(x.created_at).getTime()<30*86400000);if(!recent.length)return;
       const n=document.getElementById("disciplineNotice");if(!n)return;n.style.display="block";
       if(recent.length>=3){document.body.classList.add("academy-review-mode");n.className="academy-review-warning";n.textContent="ACCOUNT UNDER REVIEW — "+recent.length+" exam-rule events in the last 30 days. This is not an automatic suspension.";}
       else{n.className="warning";n.textContent="⚠️ ACADEMY RULE REMINDER — "+recent.length+" exam-rule event(s) recorded recently. Follow exam deadlines and submit only one paper per exam.";}
     }catch(_){}
   }




  document.getElementById("registerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = document.getElementById("regName").value.trim();
    const age = Number(document.getElementById("regAge").value);
    const whatsapp = document.getElementById("regWhatsapp").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const country = document.getElementById("regCountry").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirm").value;
    if (password !== confirm) return show("registerMessage", "Passwords do not match.");
    if (age < 18) return show("registerMessage", "You must be at least 18 years old to register.");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = "CREATING ACCOUNT...";
    show("registerMessage", "Please wait...");
    try {
      if (!client) throw new Error("The secure login service did not load. Refresh the page or try again shortly.");
      const { data, error } = await client.auth.signUp({
        email, password,
        options: { data: { full_name: name, whatsapp, country, age }, emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      if (data.session && data.user) {
        const { error: appError } = await client.from("student_applications").insert({
          user_id: data.user.id, passport_name: name,
          age, whatsapp, country
        });
        if (appError) throw appError;
        show("registerMessage", "Account created and application submitted. You can now log in.");
      } else {
        show("registerMessage", "Account created. Check your email and confirm your address. After confirmation, log in to complete your student application.");
      }
      form.reset();
    } catch (err) {
      show("registerMessage", err.message || "Registration failed. Please try again.");
    } finally {
      submit.disabled = false; submit.textContent = "CREATE ACCOUNT & APPLY";
    }
  });

  document.getElementById("verifyCertificateForm")?.addEventListener("submit", async event => {
    event.preventDefault(); show("verifyCertificateMessage","Checking certificate...");
    const number=document.getElementById("verifyCertificateNumber").value.trim();
    const {data,error}=await client.rpc("verify_academy_certificate",{p_certificate_number:number});
    if(error) { show("verifyCertificateMessage","Verification service is unavailable. Please try again later."); return; }
    show("verifyCertificateMessage",data && data.length ? "VALID — "+data[0].student_name+" | "+data[0].course+" | Issued "+data[0].issued_at : "No valid certificate was found with that number.");
  });
  const qrCertificate=new URLSearchParams(window.location.search).get("certificate");
  if(qrCertificate){
    const field=document.getElementById("verifyCertificateNumber");
    if(field){field.value=qrCertificate;setTimeout(()=>document.getElementById("verifyCertificateForm")?.requestSubmit(),350);}
  }
  function printCertificate(c) {
    const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const verifyUrl=window.location.origin+"/?certificate="+encodeURIComponent(c.certificate_number)+"#certificateVerify";
    const w=window.open("","_blank","width=1100,height=800");
    if(!w){alert("Allow pop-ups to print the certificate.");return;}
    w.document.write(`<!doctype html><html><head><title>${safe(c.certificate_number)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}.sheet{height:190mm;padding:15mm 18mm;text-align:center;position:relative;background:#fff}.academy{font:bold 27px Arial;letter-spacing:2px}.sub{font-size:16px;font-weight:bold;letter-spacing:1px;margin:12px}.name{font-size:34px;font-weight:bold;margin:12px 0}.course{font-size:21px;font-weight:bold}.rule{width:70%;border-bottom:1px solid #000;margin:8px auto}.bodycopy{font-size:15px}.signature{font-size:18px;font-weight:bold;margin-top:14px}.small{font-size:11px}.number{font-size:11px;margin-top:12px}.qrwrap{position:absolute;right:18mm;bottom:14mm;text-align:center;font-size:10px}.qr{width:150px;height:150px;margin:0 auto 5px}.qr img{width:150px;height:150px}.verify{position:absolute;left:18mm;bottom:18mm;text-align:left;font-size:10px;max-width:60%}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  
@keyframes academyGoldBlink {
  0%,100% { box-shadow:0 0 7px #d5ad5570,0 0 14px #d5ad5530; filter:brightness(1); }
  50% { box-shadow:0 0 15px #ffd978,0 0 30px #d5ad55,0 0 44px #d5ad5570; filter:brightness(1.16); }
}
.btn, button, input[type="submit"], input[type="button"] {
  animation: academyGoldBlink 1.15s ease-in-out infinite;
}
.btn:hover, button:hover, input[type="submit"]:hover, input[type="button"]:hover {
  box-shadow:0 0 20px #ffd978,0 0 38px #d5ad55;
}
  </style></head><body><main class="sheet"><div class="academy">ZAFAR BINARY ACADEMY</div><div class="sub">CERTIFICATE OF COMPLETION</div><p class="bodycopy">This certificate is proudly presented to</p><div class="name">${safe(c.student_name)}</div><div class="rule"></div><p class="bodycopy">for successfully completing</p><div class="course">${safe(c.course)}</div><p class="bodycopy">and meeting the academy's course completion requirements.</p><div class="signature">C.E.O PAUL K</div><div class="small">Chief Executive Officer · ZAFAR BINARY ACADEMY</div><div class="verify">Certificate No: ${safe(c.certificate_number)}<br>Issue date: ${safe(c.issued_at)}<br>Scan the QR code to verify this certificate online.</div><div class="qrwrap"><div id="qrcode" class="qr"></div>SCAN TO VERIFY</div></main><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\\/script><script>window.onload=()=>{new QRCode(document.getElementById("qrcode"),{text:${JSON.stringify(verifyUrl)},width:150,height:150,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});setTimeout(()=>window.print(),700)};<\\/script><script src="/academy_features.js" defer></script>



</body></html>`);
    w.document.close();
  }

  const EXAM_BUCKET="academy-exams";
  const examDate=value=>value?new Date(value).toLocaleString():"No deadline";
  async function uploadExamFile(file,path){
    const {error}=await client.storage.from(EXAM_BUCKET).upload(path,file,{upsert:true,contentType:file.type||"application/pdf"});
    if(error) throw error;
    return path;
  }
  async function signedExamLink(path){
    const {data,error}=await client.storage.from(EXAM_BUCKET).createSignedUrl(path,300);
    if(error) throw error;
    return data.signedUrl;
  }
  async function refreshAdminExams(){
    const examBox=document.getElementById("adminExamList");
    const submissionBox=document.getElementById("adminExamSubmissions");
    if(!examBox||!submissionBox)return;
    examBox.textContent="Loading exams...";
    submissionBox.textContent="Loading student papers...";
    const [{data:exams,error:examError},{data:submissions,error:submissionError}]=await Promise.all([
      client.from("academy_exams").select("*").order("created_at",{ascending:false}),
      client.from("academy_exam_submissions").select("*").order("submitted_at",{ascending:false})
    ]);
    if(examError) throw examError;
    if(submissionError) throw submissionError;
    examBox.replaceChildren();
    if(!exams.length) examBox.textContent="No exams created yet.";
    exams.forEach(exam=>{
      const row=document.createElement("div");row.style.cssText="border-top:1px solid #40331e;padding:12px 0";
      const heading=document.createElement("strong");heading.textContent=exam.title+" — "+exam.status;
      const info=document.createElement("p");info.className="note";info.textContent="Deadline: "+examDate(exam.deadline)+" · "+(exam.file_path?"PDF attached":"Text exam");
      const actions=document.createElement("div");
      const toggle=document.createElement("button");toggle.type="button";toggle.className="btn";toggle.textContent=exam.status==="published"?"UNPUBLISH":"PUBLISH";toggle.onclick=async()=>{
        try{const {error}=await client.from("academy_exams").update({status:exam.status==="published"?"draft":"published"}).eq("id",exam.id);if(error)throw error;await refreshAdminExams();}
        catch(e){alert(e.message||"Could not update exam.");}
      };
      const remove=document.createElement("button");remove.type="button";remove.className="btn outline";remove.textContent="DELETE";remove.onclick=async()=>{
        if(!confirm("Delete this exam and its submissions?"))return;
        try{const {error}=await client.from("academy_exams").delete().eq("id",exam.id);if(error)throw error;await refreshAdminExams();}
        catch(e){alert(e.message||"Could not delete exam.");}
      };
      actions.append(toggle,remove);row.append(heading,info,actions);examBox.appendChild(row);
    });
    submissionBox.replaceChildren();
    if(!submissions.length) submissionBox.textContent="No student papers submitted yet.";
    for(const sub of submissions){
      const row=document.createElement("div");row.style.cssText="border-top:1px solid #40331e;padding:12px 0";
      const title=document.createElement("strong");title.textContent=(sub.student_name||"Student")+" — "+(sub.exam_title||"Exam")+" — "+sub.status;
      const details=document.createElement("p");details.className="note";details.textContent="Student ID: "+sub.student_id+" · Submitted: "+examDate(sub.submitted_at)+(sub.score!==null?" · Score: "+sub.score:"");
      const open=document.createElement("button");open.type="button";open.className="btn outline";open.textContent="OPEN WATERMARKED PAPER";open.onclick=()=>openWatermarkedStudentFile(sub.file_path,{id:"admin",email:"rajulmoviehub@gmail.com",user_metadata:{full_name:"ACADEMY ADMIN"},__academyStudentName:"ACADEMY ADMIN"});
      const mark=document.createElement("button");mark.type="button";mark.className="btn";mark.textContent="MARK PAPER";mark.onclick=async()=>{
        const score=prompt("Enter score (e.g. 85/100):",sub.score??"");
        if(score===null)return;
        const feedback=prompt("Enter feedback for the student:",sub.feedback||"");
        if(feedback===null)return;
        try{const {error}=await client.from("academy_exam_submissions").update({score:score.trim(),feedback:feedback.trim(),status:"marked",marked_at:new Date().toISOString()}).eq("id",sub.id);if(error)throw error;await refreshAdminExams();}
        catch(e){alert(e.message||"Could not save marking.");}
      };
      row.append(title,details,open,mark);submissionBox.appendChild(row);
    }
  }
  document.getElementById("examCreateForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),message=document.getElementById("examCreateMessage");
    button.disabled=true;button.textContent="SAVING...";
    try{
      const title=document.getElementById("examTitle").value.trim();
      const content=document.getElementById("examContent").value.trim();
      const file=document.getElementById("examFile").files[0]||null;
      if(file && (file.type!=="application/pdf"||file.size>15*1024*1024))throw new Error("Attach a PDF smaller than 15 MB.");
      const {data:exam,error}=await client.from("academy_exams").insert({title,content,deadline:document.getElementById("examDeadline").value||null,status:"draft"}).select().single();
      if(error)throw error;
      if(file){
        const path="exams/"+exam.id+"/"+Date.now()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
        await uploadExamFile(file,path);
        const {error:updateError}=await client.from("academy_exams").update({file_path:path}).eq("id",exam.id);
        if(updateError)throw updateError;
      }
      form.reset();message.textContent="Exam saved as a draft. Review it below and press PUBLISH when ready for students.";
      await refreshAdminExams();
    }catch(err){message.textContent=err.message||"Could not save exam.";}
    finally{button.disabled=false;button.textContent="SAVE EXAM AS DRAFT";}
  });
  async function loadStudentExams(user){
    const wrap=document.getElementById("studentExams"),list=document.getElementById("studentExamList");
    if(!wrap||!list)return;
    wrap.style.display="block";list.textContent="Loading published examinations...";
    const {data:exams,error}=await client.from("academy_exams").select("*").eq("status","published").order("created_at",{ascending:false});
    if(error){list.textContent="Examinations are not available yet. The academy may still be setting them up.";return;}
    const {data:submissions, error:submissionError}=await client.from("academy_exam_submissions").select("*").eq("student_id",user.id);
    if(submissionError){list.textContent="Could not load your exam submissions.";return;}
    const {data:markedPapers,error:markedError}=await client.from("academy_exam_submissions").select("*").eq("status","marked").order("marked_at",{ascending:false});
    if(markedError){list.textContent="Could not load marked student papers.";return;}
    list.replaceChildren();
    if(!exams.length){const emptyExamNotice=document.createElement("p");emptyExamNotice.className="note";emptyExamNotice.textContent="No examination has been published yet.";list.appendChild(emptyExamNotice);}
    for(const exam of exams){
      const card=document.createElement("div");card.style.cssText="border-top:1px solid #40331e;padding:14px 0";
      const heading=document.createElement("strong");heading.textContent=exam.title;
      const deadline=document.createElement("p");deadline.className="note";deadline.textContent="Deadline: "+examDate(exam.deadline);
      const content=document.createElement("pre");content.style.cssText="white-space:pre-wrap;color:#eee;font:inherit;background:#101010;padding:12px;border-radius:6px";content.textContent=exam.content||"See attached PDF paper.";
      card.append(heading,deadline,content);
      if(exam.file_path){
        const download=document.createElement("button");download.type="button";download.className="btn outline";download.textContent="DOWNLOAD EXAM PDF";download.onclick=()=>openWatermarkedStudentFile(exam.file_path,user);card.appendChild(download);
      }
      const prior=submissions.find(x=>x.exam_id===exam.id);
      if(prior){
        const state=document.createElement("p");state.className="note";state.textContent="Submission: "+prior.status+(prior.status==="marked"?" · Score: "+prior.score+" · Feedback: "+(prior.feedback||"No feedback"):"");card.appendChild(state);
      }else{
        const label=document.createElement("label");label.textContent="Upload your completed paper (PDF or image)";
        const input=document.createElement("input");input.type="file";input.accept="application/pdf,image/jpeg,image/png";input.required=true;
        const submit=document.createElement("button");submit.type="button";submit.className="btn";submit.textContent="SUBMIT EXAM PAPER";
        const status=document.createElement("p");status.className="note";status.setAttribute("role","status");
        submit.onclick=async()=>{
          const file=input.files[0];if(!file){status.textContent="Choose your completed paper first.";return;}
          if(!/^(application\/pdf|image\/(jpeg|png))$/.test(file.type)||file.size>15*1024*1024){status.textContent="Use a PDF, JPG or PNG file up to 15 MB.";return;}
          if(exam.deadline&&Date.now()>new Date(exam.deadline).getTime()){status.textContent="This exam deadline has passed. Your paper was not uploaded.";await recordRuleEvent("late_exam_attempt","Attempted submission after deadline.");return;}
          const {data:existing}=await client.from("academy_exam_submissions").select("id").eq("exam_id",exam.id).eq("student_id",user.id).maybeSingle();
          if(existing){status.textContent="A paper has already been submitted for this exam.";await recordRuleEvent("duplicate_exam_attempt","Attempted a second submission.");submit.disabled=true;return;}
          submit.disabled=true;status.textContent="Uploading your paper...";
          try{
            const path="submissions/"+user.id+"/"+exam.id+"/"+Date.now()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
            await uploadExamFile(file,path);
            const {error:insertError}=await client.from("academy_exam_submissions").insert({exam_id:exam.id,student_id:user.id,student_name:user.user_metadata?.full_name||user.email||"Student",exam_title:exam.title,file_path:path,status:"submitted"});
            if(insertError){if(/duplicate|unique/i.test(insertError.message||""))await recordRuleEvent("duplicate_exam_attempt","Database rejected duplicate paper.");throw insertError;}
            status.textContent="Paper submitted successfully. Your teacher will mark it and publish your score and feedback here.";
            await loadStudentExams(user);
          }catch(e){status.textContent=e.message||"Could not submit paper.";submit.disabled=false;}
        };
        card.append(label,input,submit,status);
      }
      list.appendChild(card);
    }
    const shared=document.createElement("div");
    shared.style.cssText="border-top:1px solid #40331e;margin-top:24px;padding-top:18px";
    const sharedTitle=document.createElement("h3");
    sharedTitle.textContent="All marked student papers";
    const sharedNote=document.createElement("p");
    sharedNote.className="note";
    sharedNote.textContent="Every approved and paid student can view these papers after the academy has marked them.";
    shared.append(sharedTitle,sharedNote);
    if(!markedPapers.length){
      const empty=document.createElement("p");empty.className="note";empty.textContent="No marked papers have been published yet.";shared.appendChild(empty);
    }
    for(const paper of markedPapers){
      const row=document.createElement("div");row.style.cssText="border-top:1px solid #40331e;padding:12px 0";
      const name=document.createElement("strong");name.textContent=(paper.student_name||"Student")+" — "+(paper.exam_title||"Examination");
      const result=document.createElement("p");result.className="note";result.textContent="Score: "+(paper.score||"Marked")+" · Feedback: "+(paper.feedback||"No feedback provided")+" · Marked: "+examDate(paper.marked_at);
      const open=document.createElement("button");open.type="button";open.className="btn outline";open.textContent="VIEW MARKED PAPER";open.onclick=()=>openWatermarkedStudentFile(paper.file_path,user);
      row.append(name,result,open);shared.appendChild(row);
    }
    list.appendChild(shared);
  }
  async function loadStudentAcademicRecords(user){
    const panel=document.getElementById("studentAcademicRecords");
    if(!panel)return;
    panel.style.display="block";
    show("studentAttendanceSummary","Loading attendance...");
    show("studentProgressSummary","Loading learning progress...");
    const [{data:attendance,error:attendanceError},{data:progress,error:progressError}]=await Promise.all([
      client.from("academy_attendance").select("class_date,attendance_status,note").eq("student_id",user.id).order("class_date",{ascending:false}),
      client.from("academy_lesson_progress").select("lesson_title,progress_status,progress_percent,notes,updated_at").eq("student_id",user.id).order("updated_at",{ascending:false})
    ]);
    if(attendanceError||progressError){show("studentAttendanceSummary","Attendance and progress setup is pending. Please check again after the academy database update.");show("studentProgressSummary","Your login and course access are unaffected.");return;}
    const counted=attendance.filter(x=>x.attendance_status!=="excused");
    const attended=counted.filter(x=>["present","late"].includes(x.attendance_status)).length;
    const attendanceRate=counted.length?Math.round(attended/counted.length*100):null;
    show("studentAttendanceSummary",attendanceRate===null?"No attendance has been recorded yet.": "Attendance: "+attended+" of "+counted.length+" classes attended or late ("+attendanceRate+"%). Excused classes are excluded.");
    const avg=progress.length?Math.round(progress.reduce((sum,x)=>sum+Number(x.progress_percent||0),0)/progress.length):null;
    show("studentProgressSummary",avg===null?"No lesson progress has been recorded yet.":"Learning progress: "+avg+"% average across "+progress.length+" recorded lesson(s).");
    const progressList=document.getElementById("studentProgressList");
    progressList.replaceChildren();
    if(!progress.length){const p=document.createElement("p");p.className="note";p.textContent="Your teacher has not recorded lesson progress yet.";progressList.appendChild(p);}
    progress.forEach(item=>{
      const row=document.createElement("p");row.className="note";
      row.textContent=item.lesson_title+" — "+item.progress_status.replaceAll("_"," ")+" ("+item.progress_percent+"%)"+(item.notes?" · "+item.notes:"");
      progressList.appendChild(row);
    });
    const attendanceList=document.getElementById("studentAttendanceList");
    attendanceList.replaceChildren();
    if(!attendance.length){const p=document.createElement("p");p.className="note";p.textContent="No class attendance entries yet.";attendanceList.appendChild(p);}
    attendance.slice(0,12).forEach(item=>{
      const row=document.createElement("p");row.className="note";
      row.textContent=item.class_date+" — "+item.attendance_status+(item.note?" · "+item.note:"");
      attendanceList.appendChild(row);
    });
  }

  async function refreshAdminAcademicRecords(){
    const box=document.getElementById("adminAcademicRecords");
    if(!box)return;
    box.textContent="Loading attendance and lesson progress...";
    const [{data:attendance,error:attendanceError},{data:progress,error:progressError}]=await Promise.all([
      client.from("academy_attendance").select("*").order("class_date",{ascending:false}).limit(100),
      client.from("academy_lesson_progress").select("*").order("updated_at",{ascending:false}).limit(100)
    ]);
    if(attendanceError||progressError){box.textContent="Attendance and lesson progress tables are not installed yet. Run supabase/attendance_progress_migration.sql in the Supabase SQL Editor, then refresh this dashboard.";return;}
    box.replaceChildren();
    const headingA=document.createElement("strong");headingA.textContent="Attendance (latest 100)";
    box.appendChild(headingA);
    if(!attendance.length){const p=document.createElement("p");p.textContent="No attendance records yet.";box.appendChild(p);}
    attendance.forEach(item=>{
      const p=document.createElement("p");p.className="note";
      p.textContent=item.class_date+" · "+item.student_id+" · "+item.attendance_status+(item.note?" · "+item.note:"");
      box.appendChild(p);
    });
    const headingP=document.createElement("strong");headingP.textContent="Lesson progress (latest 100)";headingP.style.display="block";headingP.style.marginTop="16px";
    box.appendChild(headingP);
    if(!progress.length){const p=document.createElement("p");p.textContent="No lesson progress records yet.";box.appendChild(p);}
    progress.forEach(item=>{
      const p=document.createElement("p");p.className="note";
      p.textContent=item.student_id+" · "+item.lesson_title+" · "+item.progress_status.replaceAll("_"," ")+" ("+item.progress_percent+"%)"+(item.notes?" · "+item.notes:"");
      box.appendChild(p);
    });
  }

  async function loadAdminDashboard() {
    const { data: apps, error } = await client.from("student_applications").select("*").order("created_at", {ascending:false});
    if (error) throw error;
    const { data: certs, error: certError } = await client.from("certificates").select("*").order("created_at", {ascending:false});
    if (certError) throw certError;
    const {data:classSettings,error:settingsError}=await client.from("academy_class_settings").select("*").eq("id",true).maybeSingle();
    if(settingsError) {
      const message=document.getElementById("classSettingsMessage");
      if(message) message.textContent="Run supabase/registration_migration.sql in Supabase to activate class timetable settings.";
    }
    if(classSettings) {
      const agreedSchedule="Monday, Wednesday, Friday & Sunday | 8:00 PM–10:00 PM EAT (Nairobi)";
      const oldDefault="Class timetable will be announced by the academy.";
      const scheduleNeedsUpdate=!classSettings.class_schedule || classSettings.class_schedule.trim()===oldDefault;
      const savedSchedule=scheduleNeedsUpdate?agreedSchedule:classSettings.class_schedule;
      const academyWhatsAppInvite="https://chat.whatsapp.com/I5o5C2sjgo9HNAvSwdvNcD?s=cl&p=a&iam=2";
      const savedWhatsApp=classSettings.whatsapp_group_url||academyWhatsAppInvite;
      document.getElementById("classScheduleInput").value=savedSchedule;
      document.getElementById("classZoomInput").value=classSettings.zoom_meeting_url||"";
      document.getElementById("classWhatsAppInput").value=savedWhatsApp;
      if(scheduleNeedsUpdate || !classSettings.whatsapp_group_url) {
        const {error:settingsSaveError}=await client.from("academy_class_settings").upsert({
          id:true,
          class_schedule:savedSchedule,
          zoom_meeting_url:classSettings.zoom_meeting_url||"",
          whatsapp_group_url:savedWhatsApp,
          updated_at:new Date().toISOString()
        },{onConflict:"id"});
        if(settingsSaveError) {
          const message=document.getElementById("classSettingsMessage");
          if(message) message.textContent="The agreed timetable and WhatsApp link are prefilled. Tap SAVE CLASS DETAILS to publish them.";
        } else {
          const message=document.getElementById("classSettingsMessage");
          if(message) message.textContent="Agreed class timetable and WhatsApp invite saved.";
        }
      }
    }
    document.getElementById("admin").style.display = "block";
    document.getElementById("adminWorkspace").style.display = "block";
    document.getElementById("adminLocked").style.display = "none";
    document.getElementById("adminStudentCount").textContent = apps.length;
    document.getElementById("adminPendingCount").textContent = apps.filter(a=>a.application_status==="submitted").length;
    document.getElementById("adminPaidCount").textContent = apps.filter(a=>a.payment_status==="paid").length;
    document.getElementById("adminCertificateCount").textContent = certs.length;
    const tbody = document.querySelector("#adminApplications tbody");
    const searchInput=document.getElementById("adminStudentSearch");
    const applicationFilter=document.getElementById("adminApplicationFilter");
    const paymentFilter=document.getElementById("adminPaymentFilter");
    const resultsLabel=document.getElementById("adminStudentResults");
    function renderAdminStudents(){
      const query=(searchInput?.value||"").trim().toLowerCase();
      const appStatus=applicationFilter?.value||"all";
      const payStatus=paymentFilter?.value||"all";
      const filtered=apps.filter(a=>{
        const haystack=[a.passport_name,a.email,a.whatsapp,a.country,a.user_id,a.payment_reference,a.course,a.application_status,a.payment_status].filter(Boolean).join(" ").toLowerCase();
        const appMatch=appStatus==="all" || (appStatus==="submitted" ? ["submitted","pending"].includes(String(a.application_status||"").toLowerCase()) : String(a.application_status||"").toLowerCase()===appStatus);
        const payment=String(a.payment_status||"unpaid").toLowerCase();
        const payMatch=payStatus==="all" || (payStatus==="unpaid" ? ["unpaid",""].includes(payment) : payment===payStatus);
        return haystack.includes(query) && appMatch && payMatch;
      });
      tbody.replaceChildren();
      if(resultsLabel) resultsLabel.textContent=filtered.length+" of "+apps.length+" students";
      if(!filtered.length){
        const tr=document.createElement("tr"),td=document.createElement("td");
        td.colSpan=5;td.textContent="No students match these search filters.";td.style.padding="18px 8px";td.style.color="#bdb7aa";tr.appendChild(td);tbody.appendChild(tr);return;
      }
      filtered.forEach(a => {
        const tr = document.createElement("tr");
        const studentDetails=[a.passport_name||"Unnamed student",a.email||"",a.age ? a.age+" yrs" : "", "ID: "+(a.user_id||"")].filter(Boolean).join(" | ");
        const cells = [
          studentDetails,
          [a.whatsapp||"",a.country||"", "Ref: "+(a.payment_reference||"none")].filter(Boolean).join(" | "),
          a.application_status||"unknown",
          a.payment_status||"unpaid"
        ];
        cells.forEach(value => { const td=document.createElement("td"); td.textContent=value; td.style.padding="10px 8px"; td.style.borderTop="1px solid #40331e"; tr.appendChild(td); });
        const action=document.createElement("td"); action.style.padding="10px 8px"; action.style.borderTop="1px solid #40331e";
        const approve=document.createElement("button"); approve.className="btn"; approve.textContent="Approve"; approve.type="button"; approve.disabled=String(a.application_status||"").toLowerCase()==="approved"; approve.onclick=()=>updateApplication(a.id,{application_status:"approved"});
        const decline=document.createElement("button"); decline.className="btn outline"; decline.textContent="Decline"; decline.type="button"; decline.disabled=String(a.application_status||"").toLowerCase()==="declined"; decline.onclick=()=>updateApplication(a.id,{application_status:"declined"});
        const paid=document.createElement("button"); paid.className="btn"; paid.textContent="Mark paid"; paid.type="button"; paid.disabled=String(a.payment_status||"").toLowerCase()==="paid"; paid.onclick=()=>{const ref=prompt("Enter verified payment receipt/reference (required):");if(ref && ref.trim()) updateApplication(a.id,{payment_status:"paid",payment_reference:ref.trim(),payment_verified_at:new Date().toISOString()});};
        const pending=document.createElement("button"); pending.className="btn outline"; pending.textContent="Set unpaid"; pending.type="button"; pending.disabled=["unpaid","pending",""].includes(String(a.payment_status||"").toLowerCase()); pending.onclick=()=>updateApplication(a.id,{payment_status:"pending",payment_reference:null,payment_verified_at:null});
        [approve,decline,paid,pending].forEach(b=>{b.style.padding="7px 9px";b.style.fontSize="12px";action.appendChild(b);});
        tr.appendChild(action); tbody.appendChild(tr);
      });
    }
    [searchInput,applicationFilter,paymentFilter].forEach(el=>{if(el) el.oninput=renderAdminStudents;});
    const refreshButton=document.getElementById("adminRefreshStudents");
    if(refreshButton) refreshButton.onclick=()=>loadAdminDashboard();
    renderAdminStudents();
    await refreshAdminExams();
    await refreshAdminAcademicRecords();
    const attendanceDate=document.getElementById("attendanceDate");
    if(attendanceDate && !attendanceDate.value) attendanceDate.value=new Date().toISOString().slice(0,10);
    const certBox=document.getElementById("adminCertificates"); certBox.replaceChildren();
    if (!certs.length) certBox.textContent="No certificates issued yet.";
    certs.forEach(c=>{
      const row=document.createElement("div"); row.style.cssText="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-top:1px solid #40331e;padding:10px 0";
      const p=document.createElement("span");p.textContent=c.certificate_number+" — "+c.student_name+" — "+c.course+" — "+c.status;
      const print=document.createElement("button");print.type="button";print.className="btn";print.textContent="Print / Save PDF";print.onclick=()=>printCertificate(c);
      row.append(p,print);certBox.appendChild(row);
    });
  }
  document.getElementById("attendanceForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="SAVING...";
    try{
      const studentId=document.getElementById("attendanceStudentId").value.trim();
      const classDate=document.getElementById("attendanceDate").value;
      const attendanceStatus=document.getElementById("attendanceStatus").value;
      if(!/^[0-9a-f-]{36}$/i.test(studentId))throw new Error("Enter a valid student user ID.");
      if(!classDate)throw new Error("Choose the class date.");
      const {error}=await client.from("academy_attendance").upsert({
        student_id:studentId,class_date:classDate,attendance_status:attendanceStatus,
        note:document.getElementById("attendanceNote").value.trim(),updated_at:new Date().toISOString()
      },{onConflict:"student_id,class_date"});
      if(error)throw error;
      show("attendanceMessage","Attendance saved. The student can see this record in their dashboard.");
      document.getElementById("attendanceNote").value="";
      await refreshAdminAcademicRecords();
    }catch(err){show("attendanceMessage",err.message||"Could not save attendance.");}
    finally{button.disabled=false;button.textContent="SAVE ATTENDANCE";}
  });

  document.getElementById("lessonProgressForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="SAVING...";
    try{
      const studentId=document.getElementById("progressStudentId").value.trim();
      const lessonTitle=document.getElementById("progressLessonTitle").value.trim();
      const progressStatus=document.getElementById("progressStatus").value;
      let percent=Number(document.getElementById("progressPercent").value);
      if(!/^[0-9a-f-]{36}$/i.test(studentId))throw new Error("Enter a valid student user ID.");
      if(!lessonTitle)throw new Error("Enter the lesson or module name.");
      if(!Number.isInteger(percent)||percent<0||percent>100)throw new Error("Progress must be a whole number from 0 to 100.");
      if(progressStatus==="completed")percent=100;
      const {error}=await client.from("academy_lesson_progress").upsert({
        student_id:studentId,lesson_title:lessonTitle,progress_status:progressStatus,
        progress_percent:percent,notes:document.getElementById("progressNotes").value.trim(),
        updated_at:new Date().toISOString()
      },{onConflict:"student_id,lesson_title"});
      if(error)throw error;
      show("progressMessage","Lesson progress saved. The student can see the update in their dashboard.");
      await refreshAdminAcademicRecords();
    }catch(err){show("progressMessage",err.message||"Could not save lesson progress.");}
    finally{button.disabled=false;button.textContent="SAVE LESSON PROGRESS";}
  });

  document.getElementById("classSettingsForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="SAVING...";
    try {
      const schedule=document.getElementById("classScheduleInput").value.trim();
      const zoom=document.getElementById("classZoomInput").value.trim();
      const whatsapp=document.getElementById("classWhatsAppInput").value.trim();
      for(const link of [zoom,whatsapp]) if(link && !/^https:\/\//i.test(link)) throw new Error("Meeting and group links must begin with https://");
      const {error}=await client.from("academy_class_settings").upsert({id:true,class_schedule:schedule,zoom_meeting_url:zoom,whatsapp_group_url:whatsapp,updated_at:new Date().toISOString()},{onConflict:"id"});
      if(error) throw error;
      show("classSettingsMessage","Class details saved. Eligible paid and approved students can now view them.");
    } catch(err){show("classSettingsMessage",err.message||"Could not save class details.");}
    finally{button.disabled=false;button.textContent="SAVE CLASS DETAILS";}
  });
  async function updateApplication(id, changes) {
    const { error } = await client.from("student_applications").update(changes).eq("id",id);
    if (error) { alert(error.message); return; }
    await loadAdminDashboard();
  }
  document.getElementById("certificateForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form=event.currentTarget, button=form.querySelector('button[type="submit"]');
    button.disabled=true; button.textContent="ISSUING...";
    try {
      if(!document.getElementById("certCompleted").checked || !document.getElementById("certPassed").checked) throw new Error("Confirm course completion and a passed final assessment before issuing.");
      const studentId=document.getElementById("certStudentId").value.trim();
      const {data:application,error:appLookupError}=await client.from("student_applications").select("application_status,payment_status").eq("user_id",studentId).maybeSingle();
      if(appLookupError) throw appLookupError;
      if(!application || application.application_status!=="approved" || application.payment_status!=="paid") throw new Error("Certificate eligibility requires an approved application and verified paid status.");
      const number="ZBA-"+new Date().getFullYear()+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
      const {error}=await client.from("certificates").insert({
        certificate_number:number,
        student_id:studentId,
        student_name:document.getElementById("certStudentName").value.trim(),
        course:document.getElementById("certCourse").value.trim()
      });
      if(error) throw error;
      show("certificateMessage","Certificate record created: "+number+". Use its Print / Save PDF button below.");
      form.reset(); document.getElementById("certCourse").value="Full Binary Trading Course";
      await loadAdminDashboard();
    } catch(err) { show("certificateMessage",err.message||"Could not issue certificate."); }
    finally {button.disabled=false;button.textContent="ISSUE CERTIFICATE";}
  });
  document.getElementById("studentMpesaForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form=event.currentTarget;
    const button=form.querySelector('button[type="submit"]');
    const message=document.getElementById("studentMpesaMessage");
    button.disabled=true; button.textContent="SENDING REQUEST...";
    message.textContent="Connecting securely to M-Pesa...";
    try {
      const {data:sessionData,error:sessionError}=await client.auth.getSession();
      if(sessionError) throw sessionError;
      const accessToken=sessionData.session?.access_token;
      if(!accessToken) throw new Error("Your login session has expired. Please log in again.");
      const phone=document.getElementById("studentMpesaPhone").value.trim();
      const response=await fetch("/api/mpesa/stkpush",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+accessToken},
        body:JSON.stringify({phone})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error||"M-Pesa could not start the payment.");
      message.textContent="Payment request sent for approximately $"+Number(result.amount_usd).toFixed(2)+". Check "+phone+" and follow the payment prompt. Your account remains pending until the academy verifies the receipt.";
    } catch(err) {
      message.textContent=err.message||"Could not start payment. Please try again.";
    } finally {
      button.disabled=false; button.textContent="PAY WITH M-PESA";
    }
  });

  function updateAuthPanel(isLoggedIn, message) {
    const loginSection=document.getElementById("login");
    const logoutButton=document.getElementById("logoutBtn");
    const status=document.getElementById("authStatusMessage");
    if(loginSection) loginSection.style.display=isLoggedIn?"none":"block";
    if(logoutButton) logoutButton.style.display=isLoggedIn?"inline-block":"none";
    if(status) { status.textContent=message||""; status.style.display=message?"block":"none"; }
  }

  document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = "SIGNING IN...";
    try {
      if (!client) throw new Error("The secure login service did not load. Refresh the page or try again shortly.");
      const { data, error } = await client.auth.signInWithPassword({
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value
      });
      if (error) throw error;
      const user=data.user;
      // Hide the login form as soon as Supabase confirms authentication.
      // Dashboard queries may take longer or fail independently; they must not
      // make a successful sign-in look like the user was logged out.
      updateAuthPanel(true, "Signed in successfully. Loading your secure academy area...");
      show("loginMessage", "Signed in successfully. Loading your secure academy area...");
      const isAdmin=user.email?.toLowerCase()==="rajulmoviehub@gmail.com";
      if (isAdmin) {
        show("loginMessage","Administrator signed in. Loading management dashboard...");
        await loadAdminDashboard();
      } else {
        const meta=user.user_metadata||{};
        const age=Number(meta.age||0);
        if(meta.full_name && age>=18 && meta.whatsapp) {
          const {data:existingApp,error:lookupError}=await client.from("student_applications").select("id").eq("user_id",user.id).maybeSingle();
          if(lookupError) throw lookupError;
          if(!existingApp) {
            const {error:appError}=await client.from("student_applications").insert({
              user_id:user.id,passport_name:meta.full_name,age,whatsapp:meta.whatsapp,country:meta.country||""
            });
            if(appError) throw appError;
          }
        }
        const {data:application,error:applicationError}=await client.from("student_applications").select("application_status,payment_status,course,country").eq("user_id",user.id).maybeSingle();
        if(applicationError) throw applicationError;
        if(application) {
          document.getElementById("studentDashboard").style.display="block";
          await renderStudentProtection(user,application);
          await loadStudentExams(user);
       await loadRuleNotice();
          document.getElementById("feesPaymentLocked").style.display="none";
          document.getElementById("feesPaymentFormWrap").style.display="block";
          document.getElementById("studentApplicationStatus").textContent=application.application_status;
          document.getElementById("studentPaymentStatus").textContent=application.payment_status;
          document.getElementById("studentCourseName").textContent=application.course;
          const studentCountry=application.country||meta.country||"";
          document.getElementById("studentCountry").textContent=studentCountry||"Not provided";
          if(window.zbaSetStudentCountry) window.zbaSetStudentCountry(studentCountry);
          const mpesaAllowed=studentCountry==="Kenya";
          document.getElementById("feesPaymentFormWrap").style.display=mpesaAllowed?"block":"none";
          const eligible=application.payment_status==="paid" && application.application_status==="approved";
          if(eligible) await loadStudentAcademicRecords(user); else { const academicPanel=document.getElementById("studentAcademicRecords"); if(academicPanel){academicPanel.style.display="block";academicPanel.textContent="Attendance and learning progress become visible after your application is approved and payment is verified.";} }
          document.getElementById("studentNextStep").textContent=eligible
            ? "Your enrolment is approved. Your private class details are shown below."
            : application.payment_status==="paid" ? "Your payment is recorded. Await application approval."
            : mpesaAllowed ? "Open the Fees section to request your course payment with M-Pesa."
            : "International checkout is not active for "+(studentCountry||"your country")+" yet. Please wait for an official payment option; do not send money unofficially.";
          if(eligible) {
            const {data:settings,error:settingsError}=await client.from("academy_class_settings").select("*").eq("id",true).maybeSingle();
            if(settingsError) {
              document.getElementById("studentNextStep").textContent="Your enrolment is approved. The academy is preparing your private class access.";
            }
            if(settings) {
              document.getElementById("studentClassDetails").style.display="block";
              document.getElementById("studentClassSchedule").textContent=window.zbaGetLocalClassSchedule?window.zbaGetLocalClassSchedule():(settings.class_schedule||"Timetable not published.");
              const zoom=document.getElementById("studentZoomLink"),group=document.getElementById("studentWhatsAppLink");
              if(settings.zoom_meeting_url){zoom.href=settings.zoom_meeting_url;zoom.style.display="inline-block";}
              if(settings.whatsapp_group_url){group.href=settings.whatsapp_group_url;group.style.display="inline-block";}
            }
          }
          show("loginMessage","Welcome. Your student dashboard is ready below.");
        } else {
          document.getElementById("feesPaymentLocked").style.display="block";
          document.getElementById("feesPaymentFormWrap").style.display="none";
          document.getElementById("feesPaymentLocked").innerHTML='<p>Your login is active, but we could not find a course application for this account. Please contact academy support at <a href="mailto:rajulmoviehub@gmail.com">rajulmoviehub@gmail.com</a> so the application can be checked. Payment stays locked until the application is found.</p><a class="btn outline" href="#register" style="display:inline-block;margin-top:10px">RETURN TO REGISTRATION</a>';
          show("loginMessage","You are signed in, but no course application was found. Payment has not been enabled.");
        }
      }
      updateAuthPanel(true, isAdmin ? "Administrator signed in. Your management dashboard is ready." : "You are signed in. Your student area is available below.");
    } catch (err) {
      // Authentication may already have succeeded before a student/admin data query failed.
      // Keep the authenticated session visible and report the separate dashboard problem.
      let activeSession = null;
      try {
        const sessionResult = await client.auth.getSession();
        activeSession = sessionResult.data?.session || null;
      } catch (_) {}
      if (activeSession?.user) {
        updateAuthPanel(true, "You are signed in, but your dashboard could not finish loading. Details: " + (err.message || "Please contact academy support."));
        show("loginMessage", "Your email and password were accepted. Your account is signed in; the dashboard data needs attention. " + (err.message || ""));
      } else {
        show("loginMessage", err.message || "Login failed. Check your email, password, and email-confirmation status.");
      }
    } finally {
      submit.disabled = false; submit.textContent = "LOGIN";
    }
  });
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    updateAuthPanel(false, "");
    show("loginMessage", error ? error.message : "You are signed out.");
    document.getElementById("admin").style.display = "none";
    document.getElementById("adminWorkspace").style.display = "none";
    document.getElementById("adminLocked").style.display = "block";
    document.getElementById("studentDashboard").style.display = "none";
    if(activeStudentUserId){try{const held=JSON.parse(localStorage.getItem(studentSessionKey)||"null");if(held?.token===studentTabToken)localStorage.removeItem(studentSessionKey);}catch(_){}}
    activeStudentUserId="";
    document.getElementById("feesPaymentFormWrap").style.display = "none";
    document.getElementById("feesPaymentLocked").style.display = "block";

  });

  // Restore student Fees access when a logged-in student returns or refreshes the page.
  (async function restoreStudentSession() {
    try {
      const {data: sessionData, error: sessionError} = await client.auth.getSession();
      if (sessionError || !sessionData.session?.user) return;
      const user = sessionData.session.user;
      if (user.email?.toLowerCase() === "rajulmoviehub@gmail.com") {
        await loadAdminDashboard();
        updateAuthPanel(true, "Administrator session restored. Your management dashboard is ready.");
        return;
      }
      let {data: application, error: applicationError} = await client
        .from("student_applications")
        .select("application_status,payment_status,course,country")
        .eq("user_id", user.id)
        .maybeSingle();
      if (applicationError) throw applicationError;
      if (!application) {
        const meta = user.user_metadata || {};
        const age = Number(meta.age || 0);
        if (meta.full_name && age >= 18 && meta.whatsapp) {
          const {error: insertError} = await client.from("student_applications").insert({
            user_id: user.id,
            passport_name: meta.full_name,
            age,
            whatsapp: meta.whatsapp,
            country: meta.country || ""
          });
          if (insertError && !/duplicate|unique/i.test(insertError.message || "")) throw insertError;
          const refreshed = await client.from("student_applications")
            .select("application_status,payment_status,course,country")
            .eq("user_id", user.id).maybeSingle();
          if (refreshed.error) throw refreshed.error;
          application = refreshed.data;
        }
      }
      if (!application) {
        const locked = document.getElementById("feesPaymentLocked");
        if (locked) locked.style.display = "block";
        updateAuthPanel(true, "You are signed in, but no course application was found. Contact academy support for help.");
        return;
      }
      document.getElementById("feesPaymentLocked").style.display = "none";
      document.getElementById("feesPaymentFormWrap").style.display = "block";
      document.getElementById("studentDashboard").style.display = "block";
      await renderStudentProtection(user,application);
      await loadStudentExams(user);
       await loadRuleNotice();
      document.getElementById("studentApplicationStatus").textContent = application.application_status || "pending";
      document.getElementById("studentPaymentStatus").textContent = application.payment_status || "unpaid";
      document.getElementById("studentCourseName").textContent = application.course || "Full Binary Trading Course";
      const studentCountry=application.country||user.user_metadata?.country||"";
      document.getElementById("studentCountry").textContent=studentCountry||"Not provided";
      if(window.zbaSetStudentCountry) window.zbaSetStudentCountry(studentCountry);
      const mpesaAllowed=studentCountry==="Kenya";
      document.getElementById("feesPaymentFormWrap").style.display=mpesaAllowed?"block":"none";
      document.getElementById("studentNextStep").textContent =
        application.payment_status === "paid"
          ? "Your payment is recorded. Await academy approval if your application is still pending."
          : mpesaAllowed
            ? "Return to the Fees section to request your course payment with M-Pesa."
            : "International checkout is not active for "+(studentCountry||"your country")+" yet. Please wait for an official payment option; do not send money unofficially.";
      const eligibleForLearning=application.application_status==="approved" && application.payment_status==="paid";
      const academicPanel=document.getElementById("studentAcademicRecords");
      if(eligibleForLearning) await loadStudentAcademicRecords(user);
      else if(academicPanel){academicPanel.style.display="block";academicPanel.textContent="Attendance and learning progress become visible after your application is approved and payment is verified."}
      if(eligibleForLearning){
        const {data:settings}=await client.from("academy_class_settings").select("*").eq("id",true).maybeSingle();
        if(settings){
          const classPanel=document.getElementById("studentClassDetails");if(classPanel)classPanel.style.display="block";
          const schedule=document.getElementById("studentClassSchedule");if(schedule)schedule.textContent=window.zbaGetLocalClassSchedule?window.zbaGetLocalClassSchedule():(settings.class_schedule||"Timetable not published.");
          const zoom=document.getElementById("studentZoomLink"),group=document.getElementById("studentWhatsAppLink");
          if(zoom && settings.zoom_meeting_url){zoom.href=settings.zoom_meeting_url;zoom.style.display="inline-block";}
          if(group && settings.whatsapp_group_url){group.href=settings.whatsapp_group_url;group.style.display="inline-block";}
        }
      }
      updateAuthPanel(true, "Your student session has been restored.");
    } catch (err) {
      console.error("Could not restore student Fees access:", err);
      const message = document.getElementById("loginMessage");
      if (message) message.textContent = "Your session is active, but student details could not be loaded. Please contact academy support.";
    }
  })();
})();