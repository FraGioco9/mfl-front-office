import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditAccessibility } from "./browser-a11y01-helper.mjs";

export async function auditLandmarks(cdp, url, baseline) {
  assert.equal(baseline?.status,"passed","Canonical route must hydrate successfully before landmarks check.");
  const route=String(process.env.MFL_A11Y06_ROUTE || "");
  await auditAccessibility(cdp, url, baseline);
  const resetFocus = await cdp.send("Runtime.evaluate", { expression: "document.activeElement instanceof HTMLElement && document.activeElement.blur(); true", returnByValue: true });
  if (resetFocus.exceptionDetails) throw Error("A11Y-06 could not reset prior keyboard-audit focus.");
  const evalJs=async expression=>{
    const response=await cdp.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if(response.exceptionDetails)throw new Error("A11Y-06 Chromium JS failure: "+JSON.stringify(response.exceptionDetails));
    return response.result?.value;
  };
  const source=await readFile(new URL("../node_modules/axe-core/axe.min.js",import.meta.url),"utf8");
  const injected=await cdp.send("Runtime.evaluate",{expression:source,returnByValue:false});
  if(injected.exceptionDetails)throw Error("A11Y-06 axe-core injection failed");

  const before=await evalJs(`(() => {
    const main=document.getElementById("mflMainContent");
    const skip=document.querySelector(".mflSkipLink");
    const nav=document.getElementById("sidebar");
    const pager=document.querySelector("nav.pager");
    const computed=skip?getComputedStyle(skip):null;
    return {
      mainCount: document.querySelectorAll("main").length,
      mainTarget: main?.getAttribute("tabindex"),
      mainIsInsideAppShell:main?.parentElement?.id==="appShell",
      headerCount:document.querySelectorAll("body > header").length,
      skipCount:document.querySelectorAll("a.mflSkipLink").length,
      skipTarget:skip?.getAttribute("href"),
      skipBeforeHeader:!!(skip&&document.querySelector("body > header")&&
        (skip.compareDocumentPosition(document.querySelector("body > header"))&Node.DOCUMENT_POSITION_FOLLOWING)),
      navCount:document.querySelectorAll("nav#sidebar").length,
      navName:nav?.getAttribute("aria-label"),
      pagerName:pager?.getAttribute("aria-label"),
      skipInitiallyOffscreen:!!computed&&parseFloat(computed.transform.split(",").at(-1))<0,
      focusOutline:computed?.outlineStyle,
    };
  })()`);
  assert.equal(before.mainCount,1,route+" single main");
  assert.equal(before.mainTarget,"-1",route+" main must be programmatically focusable");
  assert.equal(before.mainIsInsideAppShell,true);
  assert.equal(before.headerCount,1);
  assert.equal(before.skipCount,1);
  assert.equal(before.skipTarget,"#mflMainContent");
  assert.equal(before.skipBeforeHeader,true);
  assert.equal(before.navCount,1);
  assert.equal(before.navName,"Main navigation");
  assert.equal(before.pagerName,"Pagination");
  assert.equal(before.skipInitiallyOffscreen,true);

  const axe=await evalJs(`(async()=>{
    const results=await window.axe.run(document,{
      runOnly:{type:"rule",values:["landmark-one-main","landmark-main-is-top-level","landmark-unique","bypass"]},
      iframes:false
    });
    return results.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.slice(0,8).map(n=>n.target.join(" > "))}));
  })()`);
  assert.deepEqual(axe,[],route+" landmark/bypass axe violations: "+JSON.stringify(axe));

  await evalJs(`(() => {
    document.body.tabIndex=-1;
    document.body.focus({preventScroll:true});
    document.body.removeAttribute("tabindex");
    return true;
  })()`);
  const key=async (which)=>{
    const code=which==="Tab"?9:13;
    await cdp.send("Input.dispatchKeyEvent",{
      type:which==="Enter"?"keyDown":"rawKeyDown",key:which,code:which,
      ...(which==="Enter"?{text:"\\r",unmodifiedText:"\\r"}:{}),
      windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,modifiers:0
    });
    await cdp.send("Input.dispatchKeyEvent",{type:"keyUp",key:which,code:which,
      windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,modifiers:0});
  };
  await key("Tab");
  const first=await evalJs(`(() => {
    const element=document.activeElement,skip=document.querySelector(".mflSkipLink");
    const styles=skip?getComputedStyle(skip):null;
    const rect=skip?.getBoundingClientRect();
    return {active:element===skip,text:skip?.textContent?.trim(),
      top:rect?.top,left:rect?.left,transform:styles?.transform,outline:styles?.outlineStyle};
  })()`);
  assert.equal(first.active,true,route+" first Tab must focus skip navigation: "+JSON.stringify(first));
  assert.ok(first.top>=0&&first.left>=0,"Focused skip link must be onscreen: "+JSON.stringify(first));
  assert.notEqual(first.outline,"none","Focused skip link must expose an outline.");

  await key("Enter");
  const landing=await evalJs(`(() => ({
    activeId:document.activeElement?.id,
    activeTag:document.activeElement?.tagName,
    hash:location.hash,
    mainCount:document.querySelectorAll("main").length,
    activePage:document.querySelector("main > .pageView:not([hidden])")?.id||""
  }))()`);
  assert.equal(landing.activeId,"mflMainContent",route+" Enter should put keyboard focus in main content: "+JSON.stringify(landing));
  assert.equal(landing.hash,"#mflMainContent");
  assert.equal(landing.mainCount,1);
  console.log("A11Y-06 "+route+" "+JSON.stringify({before,axe,first,landing}));
  return baseline;
}
