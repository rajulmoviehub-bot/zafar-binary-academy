/* ZAFAR BINARY ACADEMY — learning hub add-on. Uses the existing authenticated Supabase client. */
(function(){
  "use strict";
  const client=window.zbaClient;
  if(!client || !client.auth){console.warn("Academy add-on waiting for the main Supabase client.");return;}
  const ADMIN="rajulmoviehub@gmail.com";
  const $=id=>document.getElementById(id);
  const eligible=app=>app && app.application_status==="approved" && app.payment_status==="paid";
  const node=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
  const safeDate=value=>value?new Date(value).toLocaleString():"";
  function status(message,id){const el=$(id);if(el)el.textContent=message;}
  function linkButton(label,url){
    const a=node("a","btn outline",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;
  }
  async function studentFeatures(user){
    const panel=$("studentFeatureHub");if(!panel)return;
    const {data:app}=await client.from("student_applications").select("application_status,payment_status,passport_name").eq("user_id",user.id).maybeSingle();
    if(!eligible(app)){panel.style.display="none";return;}
    panel.style.display="block";
    await Promise.all([loadLessons(),loadReminders(),loadTickets(user),loadDiscussions(),loadLeaderboard(user,app)]);
    $("supportTicketForm")?.addEventListener("submit",async e=>{
      e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;
      try{
        const subject=$("supportSubject").value.trim(),message=$("supportMessage").value.trim();
        const {error}=await client.from("academy_support_tickets").insert({student_id:user.id,subject,message});
        if(error)throw error;e.currentTarget.reset();status("Your support request has been sent.", "supportStudentMessage");await loadTickets(user);
      }catch(err){status(err.message||"Could not send your request.","supportStudentMessage");}finally{b.disabled=false;}
    });
    $("discussionForm")?.addEventListener("submit",async e=>{
      e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;
      try{
        const message=$("discussionMessage").value.trim();if(!message)throw new Error("Write a message first.");
        const display=(app.passport_name||"Student").trim().split(/\s+/)[0].slice(0,24)||"Student";
        const {error}=await client.from("academy_discussions").insert({student_id:user.id,display_name:display,message});
        if(error)throw error;e.currentTarget.reset();status("Message posted to the student community.","discussionStudentMessage");await loadDiscussions();
      }catch(err){status(err.message||"Could not post your message.","discussionStudentMessage");}finally{b.disabled=false;}
    });
    $("leaderboardOptIn")?.addEventListener("change",async e=>{
      const checked=e.target.checked;
      try{
        const display=(app.passport_name||"Student").trim().split(/\s+/)[0].slice(0,24)||"Student";
        const {error}=await client.from("academy_leaderboard").upsert({student_id:user.id,display_name:display,points:0,opted_in:checked,updated_at:new Date().toISOString()},{onConflict:"student_id"});
        if(error)throw error;status(checked?"You opted in to the first-name-only leaderboard.":"You opted out of the leaderboard.","leaderboardMessage");await loadLeaderboard(user,app);
      }catch(err){e.target.checked=!checked;status(err.message||"Leaderboard setting could not be saved.","leaderboardMessage");}
    });
  }
  async function loadLessons(){
    const box=$("studentLessonList");if(!box)return;box.replaceChildren(node("p","note","Loading lessons…"));
    const {data,error}=await client.from("academy_lessons").select("id,title,description,video_url,module_name,sort_order").eq("published",true).order("sort_order").order("created_at",{ascending:false});
    box.replaceChildren();if(error){box.append(node("p","note","Lesson library setup is pending. Ask the academy administrator to run the new learning hub SQL migration."));return;}
    if(!data?.length){box.append(node("p","note","No video lessons have been published yet. Your instructor will add lessons here."));return;}
    data.forEach(item=>{const card=node("div","card");card.style.margin="10px 0";card.append(node("h4","",item.title),node("p","note",item.module_name+" · "+(item.description||"Video lesson")));card.append(linkButton("OPEN VIDEO LESSON",item.video_url));box.append(card);});
  }
  async function loadReminders(){
    const box=$("studentReminderList");if(!box)return;box.replaceChildren(node("p","note","Loading reminders…"));
    const {data,error}=await client.from("academy_reminders").select("title,body,remind_at,audience").eq("published",true).gte("remind_at",new Date(Date.now()-86400000).toISOString()).order("remind_at").limit(30);
    box.replaceChildren();if(error){box.append(node("p","note","Reminder service will appear after the learning hub migration is installed."));return;}
    if(!data?.length){box.append(node("p","note","No upcoming class or exam reminders have been posted."));return;}
    data.forEach(item=>{const row=node("div","warning");row.style.margin="8px 0";row.append(node("strong","",item.title),node("p","note",safeDate(item.remind_at)+" · "+item.audience.replaceAll("_"," ")),node("p","",item.body));box.append(row);});
  }
  async function loadTickets(user){
    const box=$("studentTicketList");if(!box)return;box.replaceChildren(node("p","note","Loading your support requests…"));
    const {data,error}=await client.from("academy_support_tickets").select("subject,message,status,admin_reply,created_at").eq("student_id",user.id).order("created_at",{ascending:false}).limit(20);
    box.replaceChildren();if(error){box.append(node("p","note","Support ticket feature is awaiting the database migration."));return;}
    if(!data?.length){box.append(node("p","note","You have not sent a support request yet."));return;}
    data.forEach(t=>{const row=node("div","card");row.style.margin="8px 0";row.append(node("strong","",t.subject),node("p","note","Status: "+t.status+" · "+safeDate(t.created_at)),node("p","",t.message));if(t.admin_reply)row.append(node("p","warning","Academy reply: "+t.admin_reply));box.append(row);});
  }
  async function loadDiscussions(){
    const box=$("studentDiscussionList");if(!box)return;box.replaceChildren(node("p","note","Loading community…"));
    const {data,error}=await client.from("academy_discussions").select("display_name,message,created_at").eq("hidden",false).order("created_at",{ascending:false}).limit(50);
    box.replaceChildren();if(error){box.append(node("p","note","Community discussion is awaiting the database migration."));return;}
    if(!data?.length){box.append(node("p","note","Be the first to start a respectful student discussion."));return;}
    data.forEach(p=>{const row=node("div","card");row.style.margin="8px 0";row.append(node("strong","",p.display_name),node("p","note",safeDate(p.created_at)),node("p","",p.message));box.append(row);});
  }
  async function loadLeaderboard(user,app){
    const box=$("studentLeaderboardList");if(!box)return;
    const {data,error}=await client.from("academy_leaderboard").select("student_id,display_name,points,opted_in").eq("opted_in",true).order("points",{ascending:false}).limit(20);
    if(error){box.textContent="Leaderboard setup is pending.";return;}
    box.replaceChildren();if(!data?.length)box.append(node("p","note","No students have opted in yet."));
    data.forEach((p,i)=>box.append(node("p","note",(i+1)+". "+p.display_name+" — "+p.points+" points")));
    const mine=await client.from("academy_leaderboard").select("opted_in").eq("student_id",user.id).maybeSingle();
    if($("leaderboardOptIn"))$("leaderboardOptIn").checked=!!mine.data?.opted_in;
  }
  async function adminFeatures(){
    const section=$("adminFeatureTools");if(!section)return;section.style.display="block";
    const [apps,lessons,tickets,posts,reminders,rankings]=await Promise.all([
      client.from("student_applications").select("id,application_status,payment_status",{count:"exact"}),
      client.from("academy_lessons").select("id,published",{count:"exact"}),
      client.from("academy_support_tickets").select("id,status",{count:"exact"}),
      client.from("academy_discussions").select("id,hidden",{count:"exact"}),
      client.from("academy_reminders").select("id,published",{count:"exact"}),
      client.from("academy_leaderboard").select("student_id,display_name,points,opted_in").eq("opted_in",true).order("points",{ascending:false}).limit(20)
    ]);
    const metrics=$("academyAnalytics");if(metrics){
      metrics.replaceChildren();
      const values=[
        ["Students",apps.count??apps.data?.length??"—"],
        ["Paid",apps.data?.filter(x=>x.payment_status==="paid").length??"—"],
        ["Published lessons",lessons.data?.filter(x=>x.published).length??"—"],
        ["Open support tickets",tickets.data?.filter(x=>["open","in_progress"].includes(x.status)).length??"—"],
        ["Visible discussions",posts.data?.filter(x=>!x.hidden).length??"—"],
        ["Published reminders",reminders.data?.filter(x=>x.published).length??"—"]
      ];
      values.forEach(([label,value])=>{const c=node("div","card");c.append(node("div","stat",String(value)),node("p","",label));metrics.append(c);});
      const note=node("p","note","Counts are based on records the administrator can read. Install the learning hub migration if a feature count is unavailable.");metrics.append(note);
    }
    await Promise.all([adminLoadLessons(),adminLoadTickets(),adminLoadDiscussions(),adminLoadLeaderboard()]);
    $("adminLessonForm")?.addEventListener("submit",async e=>{
      e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;
      try{
        const title=$("adminLessonTitle").value.trim(),url=$("adminLessonUrl").value.trim();
        if(!/^https:\/\//i.test(url))throw new Error("Video link must start with https://");
        const {error}=await client.from("academy_lessons").insert({title,description:$("adminLessonDescription").value.trim(),video_url:url,module_name:$("adminLessonModule").value.trim()||"General",sort_order:Number($("adminLessonOrder").value||0),published:$("adminLessonPublished").checked});
        if(error)throw error;e.currentTarget.reset();status("Lesson saved.","adminLessonMessage");await adminLoadLessons();
      }catch(err){status(err.message||"Could not save lesson.","adminLessonMessage");}finally{b.disabled=false;}
    });
    $("adminReminderForm")?.addEventListener("submit",async e=>{
      e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;
      try{
        const date=new Date($("adminReminderDate").value);if(!Number.isFinite(date.getTime()))throw new Error("Choose a valid reminder date and time.");
        const {error}=await client.from("academy_reminders").insert({title:$("adminReminderTitle").value.trim(),body:$("adminReminderBody").value.trim(),remind_at:date.toISOString(),audience:$("adminReminderAudience").value,published:true});
        if(error)throw error;e.currentTarget.reset();status("Reminder published inside student dashboards.","adminReminderMessage");await loadReminders();await adminFeatures();
      }catch(err){status(err.message||"Could not publish reminder.","adminReminderMessage");}finally{b.disabled=false;}
    });
  }
  async function adminLoadLessons(){
    const box=$("adminLessonList");if(!box)return;
    const {data,error}=await client.from("academy_lessons").select("*").order("sort_order");
    box.replaceChildren();if(error){box.textContent="Run academy_learning_hub_migration.sql to activate the lesson library.";return;}
    (data||[]).forEach(item=>{const row=node("div","card");row.style.margin="8px 0";row.append(node("strong","",item.title),node("p","note",item.module_name+" · "+(item.published?"Published":"Draft")));const b=node("button","btn outline",item.published?"UNPUBLISH":"PUBLISH");b.type="button";b.onclick=async()=>{const {error}=await client.from("academy_lessons").update({published:!item.published,updated_at:new Date().toISOString()}).eq("id",item.id);status(error?.message||"Lesson visibility updated.","adminLessonMessage");await adminLoadLessons();};row.append(b);box.append(row);});
    if(!data?.length)box.textContent="No lessons added yet.";
  }
  async function adminLoadTickets(){
    const box=$("adminSupportList");if(!box)return;
    const {data,error}=await client.from("academy_support_tickets").select("*").order("created_at",{ascending:false}).limit(100);
    box.replaceChildren();if(error){box.textContent="Support inbox will activate after the migration.";return;}
    (data||[]).forEach(t=>{const row=node("div","card");row.style.margin="8px 0";row.append(node("strong","",t.subject),node("p","note","Student ID: "+t.student_id+" · "+t.status),node("p","",t.message));const reply=node("textarea");reply.rows=2;reply.style.width="100%";reply.placeholder="Reply to student";reply.value=t.admin_reply||"";const select=node("select");["open","in_progress","resolved","closed"].forEach(v=>{const o=node("option","",v);o.value=v;select.append(o);});select.value=t.status;const save=node("button","btn", "SAVE REPLY / STATUS");save.type="button";save.onclick=async()=>{const {error}=await client.from("academy_support_tickets").update({admin_reply:reply.value.trim(),status:select.value,updated_at:new Date().toISOString()}).eq("id",t.id);status(error?.message||"Support ticket updated.","adminSupportMessage");await adminLoadTickets();};row.append(select,reply,save);box.append(row);});
    if(!data?.length)box.textContent="No student support tickets yet.";
  }
  async function adminLoadDiscussions(){
    const box=$("adminCommunityList");if(!box)return;
    const {data,error}=await client.from("academy_discussions").select("*").order("created_at",{ascending:false}).limit(100);
    box.replaceChildren();if(error){box.textContent="Community moderation will activate after the migration.";return;}
    (data||[]).forEach(p=>{const row=node("div","card");row.style.margin="8px 0";row.append(node("strong","",p.display_name+" · "+(p.hidden?"Hidden":"Visible")),node("p","",p.message));const b=node("button","btn outline",p.hidden?"RESTORE POST":"HIDE POST");b.type="button";b.onclick=async()=>{const {error}=await client.from("academy_discussions").update({hidden:!p.hidden}).eq("id",p.id);status(error?.message||"Post moderation saved.","adminCommunityMessage");await adminLoadDiscussions();};row.append(b);box.append(row);});
    if(!data?.length)box.textContent="No community posts yet.";
  }
  async function adminLoadLeaderboard(){
    const box=$("adminLeaderboardList");if(!box)return;
    const {data,error}=await client.from("academy_leaderboard").select("*").eq("opted_in",true).order("points",{ascending:false}).limit(100);
    box.replaceChildren();if(error){box.textContent="Leaderboard will activate after the migration.";return;}
    (data||[]).forEach(p=>{const row=node("div","card");row.style.margin="8px 0";row.append(node("strong","",p.display_name+" · "+p.points+" points"));const input=node("input");input.type="number";input.min="0";input.max="100000";input.value=p.points;const b=node("button","btn outline","UPDATE POINTS");b.type="button";b.onclick=async()=>{const points=Number(input.value);if(!Number.isInteger(points)||points<0||points>100000){status("Enter points from 0 to 100000.","adminLeaderboardMessage");return;}const {error}=await client.from("academy_leaderboard").update({points,updated_at:new Date().toISOString()}).eq("student_id",p.student_id);status(error?.message||"Leaderboard points updated.","adminLeaderboardMessage");await adminLoadLeaderboard();};row.append(input,b);box.append(row);});
    if(!data?.length)box.textContent="No opted-in students yet.";
  }
  function initForSession(session){
    if(!session?.user)return;
    const user=session.user;
    if(user.email?.toLowerCase()===ADMIN){adminFeatures().catch(e=>console.warn("Admin feature panel:",e));return;}
    studentFeatures(user).catch(e=>console.warn("Student learning hub:",e));
  }
  client.auth.onAuthStateChange((_event,session)=>{if(session)initForSession(session);});
  client.auth.getSession().then(({data})=>initForSession(data?.session)).catch(()=>{});
})();