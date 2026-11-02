"use strict";
(() => {
 if (window.__flowAutomatorUiInstalled) return;
 window.__flowAutomatorUiInstalled=true;
 const visible=el=>!!(el&&el.getClientRects().length&&!el.disabled);
 const findComposer=()=>[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].find(visible);
 const findGenerate=()=>[...document.querySelectorAll('button,[role="button"]')].find(el=>visible(el)&&/^(generate|create|make|submit)$/i.test((el.innerText||el.getAttribute("aria-label")||"").trim()));
 chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
  if(msg?.type!=="FLOW_AUTOMATOR_RUN")return;
  (async()=>{
   const composer=findComposer();
   if(!composer)throw new Error("Could not find the visible Flow prompt box. Check that a project is open.");
   composer.focus();
   if(composer.isContentEditable){composer.textContent=msg.prompt;composer.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:msg.prompt}));}
   else{const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(composer),"value")?.set;if(setter)setter.call(composer,msg.prompt);else composer.value=msg.prompt;composer.dispatchEvent(new Event("input",{bubbles:true}));}
   await new Promise(r=>setTimeout(r,250));
   const button=findGenerate();
   if(!button)throw new Error("Prompt entered, but the visible Generate/Create button was not found. Review the prompt and submit manually.");
   button.click();
   sendResponse({ok:true});
  })().catch(e=>sendResponse({ok:false,error:e.message}));
  return true;
 });
})();