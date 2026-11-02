"use strict";
const $=s=>document.querySelector(s);
const queue=[];
let running=false,stop=false;
function status(message,kind=""){const el=$("#conn");if(el){el.textContent=message;el.className="status-pill "+kind;}}
function parse(){return ($("#prompts")?.value||"").split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);}
function render(){const list=$("#queue");if(!list)return;list.replaceChildren();queue.forEach(j=>{const li=document.createElement("li");li.className=j.state;const p=document.createElement("span");p.className="ptext";p.textContent=j.prompt;const s=document.createElement("span");s.className="pstate";s.textContent=j.state;li.append(p,s);list.append(li);});$("#queueEmpty").hidden=queue.length>0;$("#promptCount").textContent=queue.length+" prompts";$("#progressSummary").textContent=queue.filter(j=>j.state==="done").length+" / "+queue.length;$("#startBtn").disabled=running||!queue.some(j=>j.state!=="done");$("#stopBtn").disabled=!running;}
function load(){const prompts=parse();if(!prompts.length){$("#promptErr").hidden=false;$("#promptErr").textContent="Add prompts separated by blank lines.";return;}$("#promptErr").hidden=true;queue.splice(0,queue.length,...prompts.map(prompt=>({prompt,state:"pending"})));render();}
$("#loadBtn")?.addEventListener("click",load);
$("#promptFile")?.addEventListener("change",async e=>{const f=e.target.files?.[0];if(f){$("#prompts").value=await f.text();load();}});
$("#dropzone")?.addEventListener("click",()=>$("#promptFile")?.click());
$("#dropzone")?.addEventListener("dragover",e=>e.preventDefault());
$("#dropzone")?.addEventListener("drop",async e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f){$("#prompts").value=await f.text();load();}});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle("active",x===b));$("#upload-pane").classList.toggle("active",b.dataset.mode==="upload");$("#paste-pane").classList.toggle("active",b.dataset.mode==="paste");}));
document.querySelectorAll('[data-genmode]').forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll('[data-genmode]').forEach(x=>x.classList.toggle("active",x===b));document.body.dataset.genMode=b.dataset.genmode;}));
$("#settingsBtn")?.addEventListener("click",()=>$("#settingsOverlay").hidden=false);
$("#settingsClose")?.addEventListener("click",()=>$("#settingsOverlay").hidden=true);
$("#clearBtn")?.addEventListener("click",()=>{queue.length=0;render();});
$("#stopBtn")?.addEventListener("click",()=>{stop=true;status("Stopping after current prompt…");});
async function runQueue(){if(running)return;const tabs=await chrome.tabs.query({url:["https://flow.google.com/*"]});const tab=tabs.find(t=>t.active)||tabs[0];if(!tab?.id){status("Open Google Flow in a tab first.","bad");return;}running=true;stop=false;render();for(const job of queue){if(stop)break;if(job.state==="done")continue;job.state="running";render();try{const result=await chrome.tabs.sendMessage(tab.id,{type:"FLOW_AUTOMATOR_RUN",prompt:job.prompt});if(!result?.ok)throw new Error(result?.error||"Flow did not accept the prompt.");job.state="done";}catch(e){job.state="error";status(e.message,"bad");}render();}running=false;render();if(!stop)status("Queue finished. Google Flow's own limits still apply.","ok");}
$("#startBtn")?.addEventListener("click",runQueue);
$("#brandVer").textContent="v1.7.0";status("Open Google Flow to connect.");render();