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
