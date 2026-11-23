(() => {
  "use strict";
  if (document.getElementById("autoV6Panel")) return;
  const style = document.createElement("style");
  style.textContent = `
    #autoV6Panel{margin:30px auto;max-width:980px;background:#111;border:1px solid #725a2d;border-radius:12px;padding:22px;color:#f6f2e9}
    #autoV6Panel h2,#autoV6Panel h3{color:#d5ad55}
    #autoV6Panel .v6-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:16px 0}
    #autoV6Panel .v6-stat{background:#191919;border:1px solid #40331e;border-radius:8px;padding:12px}
    #autoV6Panel .v6-stat strong{display:block;color:#d5ad55;font-size:22px}
    #autoV6Panel input,#autoV6Panel select{width:100%;padding:11px;background:#090909;color:#fff;border:1px solid #65512c;border-radius:5px;margin:6px 0 12px}
    #autoV6Panel .v6-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    #autoV6Panel .v6-history{max-height:220px;overflow:auto;font-size:13px}
    #autoV6Panel .v6-history div{padding:7px;border-top:1px solid #302719}
    #autoV6Panel .v6-note{background:#241d10;border-left:3px solid #d5ad55;padding:11px;font-size:13px;color:#e7d8b6}
    @media(max-width:600px){#autoV6Panel{padding:14px;margin:20px 10px}}
  `;
  document.head.appendChild(style);
  const panel = document.createElement("section");
  panel.id = "autoV6Panel";
  panel.innerHTML = `
    <div style="text-align:center"><span style="color:#d5ad55;letter-spacing:2px;font-size:12px">ZAFAR BINARY ACADEMY</span><h2>ENHANCED AUTO V6</h2><p>Automatic EVEN / ODD practice bot</p><span style="border:1px solid #d5ad55;border-radius:20px;padding:4px 12px;color:#d5ad55;font-size:12px">DEMO MODE ONLY</span></div>
    <p class="v6-note">This is a virtual-money strategy test using randomly generated practice digits. It is not connected to a broker or live market. The signal score is a rule-strength indicator, not a probability or promised win rate. Results may be wins or losses.</p>
    <div class="v6-grid">
      <div class="v6-stat">Virtual balance<strong id="v6Balance">$10,000.00</strong></div>
      <div class="v6-stat">Bot status<strong id="v6Status">STOPPED</strong></div>
      <div class="v6-stat">Win / Loss<strong id="v6WL">0 / 0</strong></div>
      <div class="v6-stat">Recorded accuracy<strong id="v6Accuracy">—</strong></div>
      <div class="v6-stat">Net virtual P/L<strong id="v6PL">$0.00</strong></div>
      <div class="v6-stat">Current signal<strong id="v6Signal">WAIT</strong></div>
    </div>
    <div class="v6-controls">
      <label>Stake (USD)<input id="v6Stake" type="number" min="1" max="10000" step="1" value="10"></label>
      <label>Stop-loss (USD)<input id="v6StopLoss" type="number" min="1" max="10000" step="1" value="100"></label>
      <label>Profit target (USD)<input id="v6Target" type="number" min="1" max="10000" step="1" value="100"></label>
      <label>Ticks per round<select id="v6Ticks"><option value="5">5 ticks</option><option value="10">10 ticks</option><option value="15">15 ticks</option></select></label>
    </div>
    <div style="text-align:center;margin:8px 0"><button class="btn" id="v6Start" type="button">START AUTO BOT</button><button class="btn outline" id="v6Stop" type="button" disabled>STOP BOT</button><button class="btn outline" id="v6Reset" type="button">RESET DEMO $10,000</button></div>
    <p id="v6Message" role="status" class="note">Bot is stopped. Configure your virtual risk limits and press Start.</p>
    <h3>Recent practice trades</h3><div class="v6-history" id="v6History">No practice trades recorded yet.</div>
  `;
  const practice = document.getElementById("practice");
  if (practice && practice.parentNode) practice.parentNode.insertBefore(panel, practice.nextSibling);
  else document.body.insertBefore(panel, document.body.firstChild);
  let balance=10000, wins=0, losses=0, net=0, running=false, timer=null, round=0, history=[];
  const el=id=>document.getElementById(id);
  const money=n=>"$"+n.toFixed(2);
  function render(){
    el("v6Balance").textContent=money(balance);
    el("v6WL").textContent=wins+" / "+losses;
    el("v6Accuracy").textContent=(wins+losses)?((wins/(wins+losses))*100).toFixed(1)+"%":"—";
    el("v6PL").textContent=money(net);
    el("v6PL").style.color=net>=0?"#57c785":"#ff7777";
    el("v6Status").textContent=running?"RUNNING":"STOPPED";
    el("v6Start").disabled=running;
    el("v6Stop").disabled=!running;
    el("v6History").innerHTML=history.length?history.map(x=>"<div>"+x+"</div>").join(""):"No practice trades recorded yet.";
  }
  function stop(message){running=false;if(timer){clearTimeout(timer);timer=null;}el("v6Message").textContent=message;render();}
  function trade(){
    if(!running)return;
    const stake=Number(el("v6Stake").value), sl=Number(el("v6StopLoss").value), target=Number(el("v6Target").value), ticks=Number(el("v6Ticks").value);
    if(!Number.isFinite(stake)||stake<1||stake>balance||!Number.isFinite(sl)||sl<1||!Number.isFinite(target)||target<1){stop("Invalid settings or insufficient virtual balance. Adjust your limits.");return;}
    const recent=Array.from({length:10},()=>Math.floor(Math.random()*10));
    const evenCount=recent.filter(n=>n%2===0).length;
    const oddCount=10-evenCount;
    const pick=evenCount===oddCount?(Math.random()<.5?"EVEN":"ODD"):(evenCount>oddCount?"EVEN":"ODD");
    const strength=Math.round(Math.abs(evenCount-oddCount)/10*100);
    el("v6Signal").textContent=pick+" · "+strength+"/100 rule score";
    el("v6Message").textContent="Round "+(round+1)+": analysing "+ticks+" virtual ticks. Signal "+pick+".";
    timer=setTimeout(()=>{
      if(!running)return;
      const resultDigit=Math.floor(Math.random()*10);
      const won=(resultDigit%2===0? "EVEN":"ODD")===pick;
      const change=won?stake*.8:-stake;
      balance+=change;net+=change;round++;
      if(won)wins++;else losses++;
      history.unshift("#"+round+" · "+pick+" · final digit "+resultDigit+" · "+(won?"WIN +"+money(change):"LOSS -"+money(-change)));
      history=history.slice(0,30);
      render();
      if(balance<=0){stop("Virtual balance reached zero. Reset the demo to practise again.");return;}
      if(net<=-sl){stop("Stop-loss reached. Auto bot stopped.");return;}
      if(net>=target){stop("Profit target reached. Auto bot stopped.");return;}
      el("v6Message").textContent="Round "+round+" complete. "+(won?"Virtual win.":"Virtual loss.")+" Next round in 2 seconds.";
      timer=setTimeout(trade,2000);
    },ticks*650);
  }
  el("v6Start").addEventListener("click",()=>{
    if(running)return;
    const stake=Number(el("v6Stake").value),sl=Number(el("v6StopLoss").value),target=Number(el("v6Target").value);
    if(!Number.isFinite(stake)||stake<1||stake>balance||!Number.isFinite(sl)||sl<1||!Number.isFinite(target)||target<1){el("v6Message").textContent="Enter a valid stake, stop-loss and profit target.";return;}
    running=true;render();el("v6Message").textContent="Auto bot started in demo mode. No real trades or payments are possible.";trade();
  });
  el("v6Stop").addEventListener("click",()=>stop("Bot stopped manually."));
  el("v6Reset").addEventListener("click",()=>{stop("Demo reset. Virtual balance restored to $10,000.");balance=10000;wins=0;losses=0;net=0;round=0;history=[];el("v6Signal").textContent="WAIT";render();});
  render();
})();