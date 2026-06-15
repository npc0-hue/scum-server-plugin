var it=Object.defineProperty;var nt=(t,e,r)=>e in t?it(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r;var k=(t,e,r)=>nt(t,typeof e!="symbol"?e+"":e,r);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))a(i);new MutationObserver(i=>{for(const n of i)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function r(i){const n={};return i.integrity&&(n.integrity=i.integrity),i.referrerPolicy&&(n.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?n.credentials="include":i.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function a(i){if(i.ep)return;i.ep=!0;const n=r(i);fetch(i.href,n)}})();const j="scum.plugin.bridge",N="1",ot="0.1.0";class st{constructor(e,r,a){k(this,"contextValue",null);k(this,"pending",new Map);k(this,"contextListeners",new Set);k(this,"nonce",new URL(window.location.href).searchParams.get("bridgeNonce")||"");k(this,"handleMessage",e=>{const r=e.data;if(!(!r||r.protocol!==j||r.version!==N||r.nonce!==this.nonce)){if(r.type==="host.context"||r.type==="host.context.update"){this.contextValue=r.payload,this.contextListeners.forEach(a=>a(this.contextValue));return}if(r.type==="host.api.response"){const a=this.pending.get(r.requestId);if(!a)return;clearTimeout(a.timeout),this.pending.delete(r.requestId);const i=r.payload;i!=null&&i.error?a.reject(new Error(i.error.message||i.error.code||"api error")):a.resolve(i==null?void 0:i.body)}}});this.pluginId=e,this.pluginVersion=r,this.routeKey=a}get context(){return this.contextValue}onContext(e){return this.contextListeners.add(e),this.contextValue&&e(this.contextValue),()=>this.contextListeners.delete(e)}init(){return window.addEventListener("message",this.handleMessage),this.send("plugin.handshake",{sdkVersion:ot}),new Promise((e,r)=>{const a=setTimeout(()=>r(new Error("bridge timeout")),1e4),i=()=>{this.contextValue?(clearTimeout(a),e(this.contextValue)):setTimeout(i,20)};i()})}ready(e={}){this.send("plugin.ready",{metadata:e})}error(e){const r=e instanceof Error?e.message:String(e||"plugin error");this.send("plugin.error",{code:"scum_admin_error",message:r.slice(0,240)})}height(e){this.send("plugin.height",{height:e})}api(e,r="GET",a){const i=D("api");return this.send("plugin.api.request",{path:e,method:r,body:a},i),new Promise((n,o)=>{const l=setTimeout(()=>{this.pending.delete(i),o(new Error("api timeout"))},1e4);this.pending.set(i,{resolve:n,reject:o,timeout:l})})}send(e,r,a=D("msg")){var i;window.parent.postMessage({protocol:j,version:N,type:e,requestId:a,traceId:(i=this.contextValue)==null?void 0:i.traceId,nonce:this.nonce,pluginId:this.pluginId,pluginVersion:this.pluginVersion,routeKey:this.routeKey,payload:r},"*")}}const D=t=>`${t}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`,m=(t,e,r,a="请刷新服务器状态，或联系具备管理权限的协作者处理。")=>({capability:t,reasonCode:e,summary:r,nextAction:a}),x=[{key:"settings",title:"SCUM 配置",path:"/settings",method:"GET",apiPath:"settings",permissions:["scum.config.read"],capability:"file.read",riskLevel:"medium",summary:"列出 WindowsServer 配置目录中的真实文件，并支持完整的 SCUM 常用配置文件读取。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("file.read","file_capability_unavailable","配置文件读取能力暂不可用。")},{key:"database",title:"数据库视图",path:"/database",method:"POST",apiPath:"database/query",permissions:["scum.database.query"],capability:"db.query",riskLevel:"medium",summary:"提交只读 SCUM.db 查询计划，由绑定 run 执行端返回有界结果。",domainOwner:"plugins/scum-admin backend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_direct_only","数据库视图已作为玩家等业务页的数据来源，独立查询页暂不作为日常入口。")},{key:"players",title:"玩家",path:"/players",method:"GET",apiPath:"players",permissions:["scum.players.read"],capability:"db.query",riskLevel:"medium",summary:"玩家列表、搜索、登录历史和权限感知操作入口。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("db.query","database_capability_unavailable","玩家数据需要绑定执行端提供只读数据库能力。")},{key:"vehicles",title:"载具",path:"/vehicles",method:"GET",apiPath:"vehicles",permissions:["scum.vehicles.read"],capability:"db.query",riskLevel:"medium",summary:"载具列表、归属和状态视图。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_capability_unavailable","载具数据需要绑定执行端提供只读数据库能力。")},{key:"territories",title:"领地",path:"/territories",method:"GET",apiPath:"territories",permissions:["scum.territories.read"],capability:"db.query",riskLevel:"medium",summary:"领地、区域、小队和地图资源视图。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_capability_unavailable","领地、区域和小队数据需要绑定执行端提供只读数据库能力。")},{key:"locks",title:"开锁",path:"/locks",method:"GET",apiPath:"locks",permissions:["scum.locks.read"],capability:"db.query",riskLevel:"medium",summary:"锁具和开锁记录视图。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_capability_unavailable","锁具和开锁记录数据需要绑定执行端提供只读数据库能力。")},{key:"gifts",title:"礼包",path:"/gifts",method:"GET",apiPath:"gifts",permissions:["scum.gifts.read"],capability:"task.query",riskLevel:"medium",summary:"礼包规则、发放记录和统计。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"not_migrated",visibility:"direct",unavailable:m("task.query","not_migrated","礼包管理需要完整发放和审计链路，当前批次暂不开放。")},{key:"events",title:"事件",path:"/events",method:"GET",apiPath:"events",permissions:["scum.events.read"],capability:"task.query",riskLevel:"medium",summary:"事件规则、活动配置和事件产物。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"not_migrated",visibility:"direct",unavailable:m("task.query","not_migrated","事件管理仍在迁移，当前仅保留直接不可用页。")},{key:"economy",title:"交易物品",path:"/economy",method:"GET",apiPath:"economy/items",permissions:["scum.economy.read"],capability:"artifact.read",riskLevel:"low",summary:"交易物品常量、价格分类和插件自有图片资源。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"not_migrated",visibility:"direct",unavailable:m("artifact.read","not_migrated","交易物品资源已归插件所有，经济管理页暂未迁移。")},{key:"logs",title:"日志",path:"/logs",method:"GET",apiPath:"logs",permissions:["scum.logs.read"],capability:"file.read",riskLevel:"medium",summary:"列出 SCUM 日志目录中的真实文件，并按受控上限读取最新内容。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("file.read","file_capability_unavailable","日志读取需要绑定执行端提供文件目录与文件读取能力。")},{key:"steam",title:"Steam",path:"/steam",method:"GET",apiPath:"steam/news",permissions:["scum.steam.read"],capability:"steam.news",riskLevel:"low",summary:"Steam 新闻、版本元数据和发布提示。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"deferred",visibility:"direct",unavailable:m("steam.news","deferred","Steam 新闻和版本面板已记录但不属于首批日常管理入口。")},{key:"update",title:"更新与重启",path:"/update",method:"POST",apiPath:"update/server",permissions:["scum.update.mutate","scum.restart.mutate"],capability:"steamcmd.update",riskLevel:"high",summary:"SteamCMD 安装、服务端更新和受控重启任务。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("steamcmd.update","update_capability_unavailable","更新与重启需要可用的任务、进程和 SteamCMD 能力。")},{key:"tasks",title:"任务",path:"/tasks",method:"GET",apiPath:"tasks",permissions:["scum.tasks.read"],capability:"task.query",riskLevel:"medium",summary:"SCUM 插件任务状态、结果摘要和稳定错误。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("task.query","task_capability_unavailable","任务列表需要任务状态查询能力。")}];x.filter(t=>t.migrationStatus==="migrated").map(t=>t.key);const E=x.filter(t=>t.visibility==="normal"),I=t=>x.find(e=>e.key===t)||x[0],lt=[{section:"SCUM.Server",key:"MaxPlayers",label:"最大玩家数",validator:"1-256"},{section:"SCUM.Server",key:"ServerName",label:"服务器名称",validator:"1-128 字符"}],w=(t,e="unavailable")=>({kind:"unavailable",state:e,route:t.key,domain:t.key,title:t.title,summary:t.summary,unavailable:{code:t.unavailable.reasonCode,reasonCode:t.unavailable.reasonCode,summary:t.unavailable.summary,nextAction:t.unavailable.nextAction}}),ct=`
  :root {
    color-scheme: dark;
    background: transparent;
  }

  html,
  body {
    min-height: 100%;
    margin: 0;
    background: transparent;
  }

  * {
    box-sizing: border-box;
  }

  .scum-admin-plugin {
    --plugin-primary: var(--plugin-theme-primary-color, #36ad6a);
    --plugin-primary-hover: var(--plugin-theme-primary-color-hover, #43c177);
    --plugin-info: var(--plugin-theme-info-color, #4098fc);
    --plugin-warning: var(--plugin-theme-warning-color, #ffb020);
    --plugin-error: var(--plugin-theme-error-color, #f23f42);
    --plugin-bg: var(--plugin-theme-app-bg-color, #101014);
    --plugin-panel: var(--plugin-theme-panel-bg-color, rgba(23, 27, 36, 0.78));
    --plugin-panel-strong: var(--plugin-theme-panel-strong-bg-color, rgba(21, 25, 34, 0.96));
    --plugin-panel-soft: var(--plugin-theme-hover-color, rgba(255, 255, 255, 0.045));
    --plugin-border: var(--plugin-theme-border-color, rgba(255, 255, 255, 0.12));
    --plugin-border-strong: rgba(255, 255, 255, 0.18);
    --plugin-text: var(--plugin-theme-text-color, #f4f4f5);
    --plugin-text-strong: #f8fafc;
    --plugin-muted: var(--plugin-theme-muted-text-color, #a1a1aa);
    --plugin-control: var(--plugin-theme-control-bg-color, rgba(16, 16, 20, 0.78));
    --plugin-control-focus: var(--plugin-theme-control-focus-bg-color, rgba(16, 16, 20, 0.92));
    --plugin-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
    min-height: 100vh;
    padding: 16px;
    color: var(--plugin-text);
    background: transparent;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }

  .scum-admin-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    padding: 0 0 16px;
    border-bottom: 1px solid var(--plugin-border);
  }

  .scum-admin-header h1 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 22px;
    font-weight: 720;
  }

  .scum-admin-status {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    line-height: 1.5;
  }

  .scum-admin-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 16px 0;
  }

  .scum-admin-tabs button {
    min-height: 34px;
    padding: 7px 11px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    color: #d4d4d8;
    background: var(--plugin-control);
    cursor: pointer;
    font: inherit;
    letter-spacing: 0;
  }

  .scum-admin-tabs button:hover {
    border-color: color-mix(in srgb, var(--plugin-primary) 45%, transparent);
    color: #ffffff;
    background: var(--plugin-panel-soft);
  }

  .scum-admin-tabs button[aria-current="page"] {
    border-color: color-mix(in srgb, var(--plugin-primary) 55%, transparent);
    color: #ffffff;
    background: color-mix(in srgb, var(--plugin-primary) 16%, transparent);
  }

  .scum-admin-tabs button[data-status="not_migrated"],
  .scum-admin-tabs button[data-status="deferred"] {
    color: #8b8b94;
  }

  .route-surface {
    padding: 16px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025)),
      var(--plugin-panel-strong);
    backdrop-filter: blur(18px) saturate(1.25);
    -webkit-backdrop-filter: blur(18px) saturate(1.25);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), var(--plugin-shadow);
  }

  .surface-title {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 14px;
  }

  .surface-title h2 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 18px;
    font-weight: 700;
  }

  .surface-title p {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    line-height: 1.5;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 4px 9px;
    border: 1px solid var(--plugin-border);
    border-radius: 999px;
    color: #d4d4d8;
    background: var(--plugin-panel-soft);
    font-size: 12px;
    white-space: nowrap;
  }

  .status-pill[data-tone="ok"] {
    border-color: rgba(54, 173, 106, 0.5);
    color: #9ae6b4;
    background: rgba(54, 173, 106, 0.14);
  }

  .status-pill[data-tone="warn"] {
    border-color: rgba(255, 176, 32, 0.5);
    color: #ffd37a;
    background: rgba(255, 176, 32, 0.12);
  }

  .status-pill[data-tone="error"] {
    border-color: rgba(242, 63, 66, 0.52);
    color: #ffb4b5;
    background: rgba(242, 63, 66, 0.12);
  }

  .controls {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    margin: 12px 0;
  }

  .controls input,
  .controls select,
  .field-grid input {
    min-height: 36px;
    padding: 8px 9px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    color: var(--plugin-text);
    background: var(--plugin-control);
    font: inherit;
    letter-spacing: 0;
    outline: none;
  }

  .controls input:focus,
  .controls select:focus,
  .field-grid input:focus {
    border-color: var(--plugin-primary);
    background: var(--plugin-control-focus);
  }

  .controls input::placeholder {
    color: #71717a;
  }

  .controls button,
  .action-button {
    min-height: 36px;
    padding: 8px 11px;
    border: 1px solid var(--plugin-primary);
    border-radius: 6px;
    color: #ffffff;
    background: var(--plugin-primary);
    cursor: pointer;
    font: inherit;
    letter-spacing: 0;
  }

  .controls button:hover,
  .action-button:hover {
    border-color: var(--plugin-primary-hover);
    background: var(--plugin-primary-hover);
  }

  .controls button.secondary,
  .action-button.secondary {
    border-color: var(--plugin-border-strong);
    color: #d4d4d8;
    background: var(--plugin-panel-soft);
  }

  .controls button.secondary:hover,
  .action-button.secondary:hover {
    border-color: rgba(255, 255, 255, 0.24);
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .controls button:disabled,
  .action-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .notice {
    margin: 10px 0;
    padding: 10px;
    border: 1px solid rgba(255, 176, 32, 0.45);
    border-radius: 6px;
    color: #ffd37a;
    background: rgba(255, 176, 32, 0.1);
    line-height: 1.5;
  }

  .notice p {
    margin: 6px 0 0;
  }

  .notice.error {
    border-color: rgba(242, 63, 66, 0.52);
    color: #ffb4b5;
    background: rgba(242, 63, 66, 0.12);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin: 12px 0;
  }

  .meta-item {
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    background: var(--plugin-panel-soft);
  }

  .meta-item strong {
    display: block;
    margin-bottom: 4px;
    color: var(--plugin-text-strong);
    font-size: 12px;
  }

  .meta-item span {
    color: var(--plugin-muted);
    font-size: 12px;
    word-break: break-word;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 10px;
    margin: 12px 0;
  }

  .field-grid label {
    display: grid;
    gap: 6px;
    min-width: 0;
    color: var(--plugin-muted);
  }

  .field-grid strong {
    color: var(--plugin-text);
    font-size: 13px;
  }

  .field-grid span {
    color: var(--plugin-muted);
    font-size: 12px;
  }

  .diff-box,
  .log-box {
    max-height: 260px;
    overflow: auto;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #dbeafe;
    background: rgba(6, 10, 20, 0.92);
    white-space: pre-wrap;
    word-break: break-word;
  }

  table {
    width: 100%;
    margin-top: 12px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 9px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: #d4d4d8;
    background: rgba(255, 255, 255, 0.04);
    font-size: 12px;
    font-weight: 680;
  }

  tr:hover td {
    background: rgba(255, 255, 255, 0.045);
  }

  .empty {
    padding: 18px;
    border: 1px dashed rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    color: var(--plugin-muted);
    background: rgba(255, 255, 255, 0.025);
    text-align: center;
  }

  .task-list {
    display: grid;
    gap: 10px;
  }

  .task-row {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    color: var(--plugin-text);
    background: var(--plugin-panel);
  }

  .task-row p {
    margin: 0;
    color: var(--plugin-muted);
  }

  .task-row details {
    color: var(--plugin-muted);
  }

  .task-row pre {
    overflow: auto;
    margin: 8px 0 0;
    color: #dbeafe;
    white-space: pre-wrap;
  }

  @media (max-width: 700px) {
    .scum-admin-header,
    .surface-title {
      display: block;
    }

    .controls {
      display: grid;
    }

    .controls input,
    .controls select,
    .controls button {
      width: 100%;
    }
  }
`,dt=async()=>{const t=document.getElementById("scum-admin-plugin-root")||document.body,e=new URL(window.location.href).searchParams.get("routeKey")||"settings",r=new st("scum-admin","0.1.8",e),a=document.createElement("main");a.className="scum-admin-plugin",a.innerHTML=`
    <style>
      ${ct}
    </style>
    <header class="scum-admin-header">
      <div>
        <h1>SCUM 管理</h1>
        <p class="scum-admin-status" data-role="status">正在通过 host bridge 初始化...</p>
      </div>
    </header>
    <nav class="scum-admin-tabs" aria-label="SCUM 管理域" data-role="nav"></nav>
    <section class="route-surface" data-role="content"></section>
  `,t.appendChild(a),r.onContext(s=>ut(a,s.themeTokens));const i=a.querySelector('[data-role="status"]'),n=a.querySelector('[data-role="nav"]'),o=a.querySelector('[data-role="content"]');if(!i||!n||!o)return;const l={bridge:r,context:null,route:I(e),content:o,status:i,nav:n};M(l),g(l,{state:"loading",title:l.route.title,summary:l.route.summary});try{const s=await r.init();l.context=s,l.route=I(s.routeKey||e),i.textContent=`已连接 host bridge，当前实例：${s.serverInstanceId||"未选择"}`,M(l),await B(l,l.route.key),r.ready({surface:l.route.key,routes:x.map(u=>u.key)}),r.height(document.documentElement.scrollHeight)}catch(s){const u=s instanceof Error?s.message:String(s);i.textContent=`host bridge 初始化失败：${u}`,r.error(s)}},ut=(t,e)=>{if(e)for(const[r,a]of Object.entries(e))/^[a-zA-Z][a-zA-Z0-9]*$/.test(r)&&typeof a=="string"&&t.style.setProperty(`--plugin-theme-${_t(r)}`,a)},M=t=>{const e=pt(t.route);t.nav.innerHTML=e.map(r=>`
    <button type="button" data-route="${r.key}" data-status="${r.migrationStatus}" aria-current="${r.key===t.route.key?"page":"false"}">
      ${c(r.title)}
    </button>
  `).join(""),t.nav.querySelectorAll("button").forEach(r=>{r.addEventListener("click",()=>{B(t,r.dataset.route||"settings")})})},pt=t=>E.some(e=>e.key===t.key)?E:[t,...E],B=async(t,e)=>{if(t.route=I(e),M(t),g(t,{state:"loading",title:t.route.title,summary:t.route.summary}),t.route.migrationStatus==="not_migrated"||t.route.migrationStatus==="deferred"){R(t,w(t.route,t.route.migrationStatus));return}if(t.route.key==="update"){vt(t,w(t.route,"available"));return}try{const r=await t.bridge.api(t.route.apiPath,t.route.method,Et(t.route));H(t,et(t.route,r))}catch(r){H(t,rt(t.route,r))}},g=(t,e)=>{const r=t.route,a=Ct(e);t.content.innerHTML=`
    <div class="surface-title">
      <div>
        <h2>${c(r.title)}</h2>
        <p>${c(r.summary)}</p>
      </div>
      <span class="status-pill" data-tone="${a}">${It(r,e)}</span>
    </div>
    <div data-role="route-body"><div class="empty">正在加载 ${c(r.title)}...</div></div>
  `},H=(t,e)=>{switch(t.route.key){case"settings":gt(t,e);return;case"players":bt(t,e);return;case"vehicles":C(t,e,{empty:"暂无载具数据。",columns:[{key:"id",label:"载具 ID"},{key:"vehicleType",label:"载具类型"},{key:"ownerPrisonerId",label:"归属玩家"},{key:"locationX",label:"X"},{key:"locationY",label:"Y"},{key:"locationZ",label:"Z"}]});return;case"territories":C(t,e,{empty:"暂无领地或小队数据。",columns:[{key:"territoryId",label:"领地 ID"},{key:"ownerName",label:"归属角色"},{key:"ownerSteamId",label:"SteamID"},{key:"squadName",label:"所属小队"},{key:"locationX",label:"X"},{key:"locationY",label:"Y"}]});return;case"locks":C(t,e,{empty:"暂无锁具数据。",columns:[{key:"id",label:"锁具 ID"},{key:"lockType",label:"锁具类型"},{key:"ownerPrisonerId",label:"归属玩家"},{key:"locationX",label:"X"},{key:"locationY",label:"Y"},{key:"locationZ",label:"Z"}]});return;case"logs":yt(t,e);return;case"tasks":kt(t,e);return;case"database":mt(t,e);return;default:R(t,e)}},R=(t,e)=>{var r,a,i;g(t,e),d(t).innerHTML=`
    <div class="notice">
      <strong>${c(((r=e.unavailable)==null?void 0:r.reasonCode)||t.route.unavailable.reasonCode)}</strong>
      <p>${c(((a=e.unavailable)==null?void 0:a.summary)||t.route.unavailable.summary)}</p>
      <p>${c(((i=e.unavailable)==null?void 0:i.nextAction)||t.route.unavailable.nextAction)}</p>
    </div>
  `},mt=(t,e)=>{g(t,e),d(t).innerHTML=`
    <div class="notice">
      数据库独立查询页当前只作为直接访问的迁移占位。玩家、日志等业务页会通过插件后端使用受控查询模板。
    </div>
  `},gt=(t,e)=>{var s,u,b,v,f,F,A;g(t,e);const r=!h(e),a=Array.isArray((s=e.data)==null?void 0:s.workspaces)?e.data.workspaces:[],i=Array.isArray((u=e.data)==null?void 0:u.supportedFiles)?e.data.supportedFiles.filter($=>typeof $=="string"):[],n=Array.isArray((b=e.data)==null?void 0:b.structuredFields)?e.data.structuredFields:lt,o=typeof((v=e.data)==null?void 0:v.structuredPath)=="string"?e.data.structuredPath:"";if(d(t).innerHTML=`
    ${S(t.route,e)}
    <div class="controls">
      <select data-role="settings-workspace" ${r?"disabled":""}>
        ${a.map($=>`
          <option value="${c($.key)}">${c($.title)}</option>
        `).join("")}
      </select>
      <select data-role="settings-file" ${r?"disabled":""}></select>
      <button type="button" class="action-button" data-action="reload-settings" ${r?"disabled":""}>读取配置</button>
    </div>
    <div class="notice" data-role="settings-status">等待读取配置目录。</div>
    <div class="meta-grid" data-role="settings-meta"></div>
    <div class="field-grid" data-role="settings-fields"></div>
    <pre class="diff-box" data-role="diff">暂无配置内容。</pre>
  `,r||a.length===0)return;const l=()=>{ft(t,a,i,n,o)};(f=d(t).querySelector('[data-action="reload-settings"]'))==null||f.addEventListener("click",l),(F=d(t).querySelector('[data-role="settings-workspace"]'))==null||F.addEventListener("change",l),(A=d(t).querySelector('[data-role="settings-file"]'))==null||A.addEventListener("change",()=>{V(t,n,o)}),l()},bt=(t,e)=>{var n,o;g(t,e);const r=!h(e),a=O(e,[{id:"sample-1",name:"Prisoner One",steamId:"7656******0001",lastSeen:"待执行端返回",status:r?"不可用":"在线"}]),i=at(e);d(t).innerHTML=`
    ${S(t.route,e)}
    ${i?`<div class="notice"><strong>数据来源</strong><p>${c(i)}</p></div>`:""}
    <div class="controls">
      <input type="search" data-role="player-search" placeholder="搜索玩家、SteamID 或状态" />
      <button type="button" class="action-button secondary" data-action="show-player-detail" ${a.length===0?"disabled":""}>查看详情</button>
      <button type="button" class="action-button secondary" disabled>踢出</button>
      <button type="button" class="action-button secondary" disabled>封禁</button>
      <button type="button" class="action-button secondary" disabled>发物品</button>
    </div>
    <div data-role="players-table">${U(a)}</div>
    <div class="task-row" data-role="player-detail">选择“查看详情”以显示当前第一名玩家的结构化详情占位。</div>
  `,(n=d(t).querySelector('[data-role="player-search"]'))==null||n.addEventListener("input",l=>{const s=l.target.value.toLowerCase(),u=a.filter(v=>Object.values(v).some(f=>String(f).toLowerCase().includes(s))),b=d(t).querySelector('[data-role="players-table"]');b&&(b.innerHTML=U(u))}),(o=d(t).querySelector('[data-action="show-player-detail"]'))==null||o.addEventListener("click",()=>{const l=d(t).querySelector('[data-role="player-detail"]');if(!l)return;const s=a[0]||{};l.innerHTML=`
      <strong>${c(String(s.name||s.id||"玩家详情"))}</strong>
      <p>SteamID: ${c(String(s.steamId||s.steamID||"-"))}</p>
      <p>状态: ${c(String(s.status||"-"))}</p>
      <p>最近活动: ${c(String(s.lastSeen||s.updatedAt||"-"))}</p>
      <details>
        <summary>查看结构化数据</summary>
        <pre>${c(JSON.stringify(s,null,2))}</pre>
      </details>
    `})},C=(t,e,r)=>{g(t,e);const a=at(e),i=!h(e),n=O(e,i?[]:[wt(r.columns)]);d(t).innerHTML=`
    ${S(t.route,e)}
    ${a?`<div class="notice"><strong>数据来源</strong><p>${c(a)}</p></div>`:""}
    ${xt(n,r.columns,r.empty)}
  `},yt=(t,e)=>{var n,o,l,s;g(t,e);const r=!h(e),a=Array.isArray((n=e.data)==null?void 0:n.workspaces)?e.data.workspaces:[];if(d(t).innerHTML=`
    ${S(t.route,e)}
    <div class="controls">
      <select data-role="log-workspace" ${r?"disabled":""}>
        ${a.map(u=>`
          <option value="${c(u.key)}">${c(u.title)}</option>
        `).join("")}
      </select>
      <select data-role="log-file" ${r?"disabled":""}></select>
      <button type="button" class="action-button" data-action="reload-logs" ${r?"disabled":""}>读取日志</button>
    </div>
    <div class="notice" data-role="logs-status">等待读取日志目录。</div>
    <div class="meta-grid" data-role="logs-meta"></div>
    <pre class="log-box" data-role="logs">暂无日志结果。</pre>
  `,r||a.length===0)return;const i=()=>{ht(t,a)};(o=d(t).querySelector('[data-action="reload-logs"]'))==null||o.addEventListener("click",i),(l=d(t).querySelector('[data-role="log-workspace"]'))==null||l.addEventListener("change",i),(s=d(t).querySelector('[data-role="log-file"]'))==null||s.addEventListener("change",()=>{G(t)}),i()},ft=async(t,e,r,a,i)=>{var l,s;const n=((l=d(t).querySelector('[data-role="settings-workspace"]'))==null?void 0:l.value)||((s=e[0])==null?void 0:s.key)||"",o=e.find(u=>u.key===n)||e[0];if(!o){p(t,"settings-status","未找到配置目录。",!0);return}p(t,"settings-status",`正在读取 ${o.title}...`);try{const u=await K(t,o.directoryPath),b=o.supportedFiles&&o.supportedFiles.length>0?o.supportedFiles:r,v=Lt(u,b),f=Y(v,b);X(t,"settings-file",f,o.defaultFilePath),p(t,"settings-status",`${o.title} 已加载，共 ${f.length} 个受支持文件。`),await V(t,a,i)}catch(u){p(t,"settings-status",T(u),!0),y(t,"settings-meta",[]),L(t,[]),P(t,"暂无配置内容。")}},V=async(t,e,r)=>{var i;const a=((i=d(t).querySelector('[data-role="settings-file"]'))==null?void 0:i.value)||"";if(!a){p(t,"settings-status","当前目录下没有可读取的配置文件。",!0),y(t,"settings-meta",[]),L(t,[]),P(t,"暂无配置内容。");return}p(t,"settings-status",`正在读取 ${a}...`);try{const n=await W(t,a),o=typeof n.content=="string"?n.content:"",l=tt(o),s=a===r?qt(e,o):[];L(t,s),y(t,"settings-meta",[{label:"文件路径",value:a},{label:"校验和",value:typeof n.checksum=="string"?n.checksum:"-"},{label:"文件大小",value:Q(n.sizeBytes)},{label:"截断状态",value:n.truncated?"已截断":"完整"}]),P(t,l||"文件为空。"),p(t,"settings-status",`${a} 已加载。`)}catch(n){p(t,"settings-status",T(n),!0),y(t,"settings-meta",[]),L(t,[]),P(t,"暂无配置内容。")}},ht=async(t,e)=>{var i,n;const r=((i=d(t).querySelector('[data-role="log-workspace"]'))==null?void 0:i.value)||((n=e[0])==null?void 0:n.key)||"",a=e.find(o=>o.key===r)||e[0];if(!a){p(t,"logs-status","未找到日志目录。",!0);return}p(t,"logs-status",`正在读取 ${a.title}...`);try{const o=await K(t,a.directoryPath);X(t,"log-file",Y(o,a.preferredFiles||[])),p(t,"logs-status",`${a.title} 已加载，共 ${o.length} 个文件。`),await G(t)}catch(o){p(t,"logs-status",T(o),!0),y(t,"logs-meta",[]),q(t,"暂无日志结果。")}},G=async t=>{var r;const e=((r=d(t).querySelector('[data-role="log-file"]'))==null?void 0:r.value)||"";if(!e){p(t,"logs-status","当前目录下没有可读取的日志文件。",!0),y(t,"logs-meta",[]),q(t,"暂无日志结果。");return}p(t,"logs-status",`正在读取 ${e}...`);try{const a=await W(t,e),i=typeof a.content=="string"?a.content:"";y(t,"logs-meta",[{label:"文件路径",value:e},{label:"校验和",value:typeof a.checksum=="string"?a.checksum:"-"},{label:"文件大小",value:Q(a.sizeBytes)},{label:"截断状态",value:a.truncated?`已截断，偏移 ${a.readOffset||0}`:"完整"}]),q(t,tt(i)||"日志文件为空。"),p(t,"logs-status",`${e} 已加载。`)}catch(a){p(t,"logs-status",T(a),!0),y(t,"logs-meta",[]),q(t,"暂无日志结果。")}},vt=(t,e)=>{g(t,e),d(t).innerHTML=`
    <div class="notice">
      更新和重启属于高风险操作。必须勾选确认后，插件才会提交受治理的 operation handle。
    </div>
    <label class="controls">
      <input type="checkbox" data-role="confirm-update" />
      <span>我确认这是当前服务器的维护窗口</span>
    </label>
    <div class="controls">
      <button type="button" class="action-button" data-action="update-server">更新服务端</button>
      <button type="button" class="action-button secondary" data-action="restart-server">受控重启</button>
    </div>
    <div class="task-row" data-role="operation-result">尚未提交操作。</div>
  `,z(t,"update-server","update/server"),z(t,"restart-server","server/restart")},kt=(t,e)=>{g(t,e);const r=!h(e),a=O(e,[{id:"pending-dispatch",type:"plugin-operation",status:r?"不可用":"等待执行端",summary:"等待插件任务状态能力返回结果"}]);d(t).innerHTML=`
    ${S(t.route,e)}
    <div class="task-list">
      ${a.map(i=>`
        <article class="task-row">
          <strong>${c(String(i.type||i.id||"任务"))}</strong>
          <span>${c(String(i.status||"状态未知"))}</span>
          <p>${c(String(i.summary||"暂无摘要"))}</p>
          <details>
            <summary>查看安全详情</summary>
            <pre>${c(JSON.stringify(i,null,2))}</pre>
          </details>
        </article>
      `).join("")}
    </div>
  `},z=(t,e,r)=>{var a;(a=d(t).querySelector(`[data-action="${e}"]`))==null||a.addEventListener("click",async()=>{var l;const i=((l=d(t).querySelector('[data-role="confirm-update"]'))==null?void 0:l.checked)||!1,n=d(t).querySelector('[data-role="operation-result"]');if(!i){n&&(n.textContent="请先确认维护窗口。");return}n&&(n.textContent="正在提交 operation handle...");const o=await t.bridge.api(r,"POST",{confirmed:!0,action:e}).catch(s=>rt(t.route,s));n&&(n.textContent=Mt(et(t.route,o)))})},U=t=>t.length===0?'<div class="empty">没有匹配的玩家。</div>':`
    <table>
      <thead><tr><th>玩家</th><th>SteamID</th><th>状态</th><th>最近活动</th></tr></thead>
      <tbody>
        ${t.map(e=>`
          <tr>
            <td>${c(String(e.name||e.id||"-"))}</td>
            <td>${c(String(e.steamId||e.steamID||"-"))}</td>
            <td>${c(String(e.status||"-"))}</td>
            <td>${c(String(e.lastSeen||e.updatedAt||"-"))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `,xt=(t,e,r)=>t.length===0?`<div class="empty">${c(r)}</div>`:`
    <table>
      <thead><tr>${e.map(a=>`<th>${c(a.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${t.map(a=>`
          <tr>${e.map(i=>`<td>${c(String(a[i.key]??"-"))}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `,wt=t=>{const e={};for(const r of t)e[r.key]=`待返回${r.label}`;return e},K=async(t,e)=>{var n;const r=J(t),a=await _(`/api/v1/server-instances/${encodeURIComponent(r)}/files?path=${encodeURIComponent(e)}`),i=await Z(a.operation.id);return $t((n=i.result)==null?void 0:n.entries)},W=async(t,e)=>{var n,o,l,s,u;const r=J(t),a=await _(`/api/v1/server-instances/${encodeURIComponent(r)}/files/read`,{method:"POST",body:JSON.stringify({path:e,contentMode:"text"})}),i=await Z(a.operation.id);return{content:(n=i.result)==null?void 0:n.content,checksum:(o=i.result)==null?void 0:o.checksum,sizeBytes:Number(((l=i.result)==null?void 0:l.sizeBytes)||0),truncated:!!((s=i.result)!=null&&s.truncated),readOffset:Number(((u=i.result)==null?void 0:u.readOffset)||0)}},_=async(t,e={})=>{const r=await fetch(t,{...e,credentials:"same-origin",headers:{Accept:"application/json",...e.body?{"Content-Type":"application/json"}:{},...e.headers||{}}});if(!r.ok)throw new Error(await St(r));return await r.json()},Z=async t=>{for(let e=0;e<30;e+=1){const r=await _(`/api/v1/file-operations/${encodeURIComponent(t)}`);if(r.status==="succeeded")return r;if(r.status==="failed"||r.status==="rejected"||r.status==="conflicted")throw new Error(r.errorMessage||r.errorCode||"file operation failed");await Tt(300)}throw new Error("file operation timed out")},St=async t=>{const e=await t.text();try{const r=JSON.parse(e);if(r!=null&&r.error)return r.error}catch{}return e||`request failed: ${t.status}`},$t=t=>Array.isArray(t)?t.filter(e=>!!(e&&typeof e=="object"&&typeof e.relativePath=="string")).filter(e=>!e.directory):[],X=(t,e,r,a)=>{var o,l;const i=d(t).querySelector(`[data-role="${e}"]`);if(!i)return;const n=((o=r.find(s=>s.relativePath===a))==null?void 0:o.relativePath)||((l=r[0])==null?void 0:l.relativePath)||"";i.innerHTML=r.map(s=>`
    <option value="${c(s.relativePath)}"${s.relativePath===n?" selected":""}>${c(s.name)}</option>
  `).join("")},Y=(t,e)=>{if(e.length===0)return t;const r=new Map(e.map((a,i)=>[a.toLowerCase(),i]));return[...t].sort((a,i)=>{const n=r.has(a.name.toLowerCase())?r.get(a.name.toLowerCase()):e.length+1,o=r.has(i.name.toLowerCase())?r.get(i.name.toLowerCase()):e.length+1;return n===o?a.name.localeCompare(i.name):n-o})},Lt=(t,e)=>{if(e.length===0)return t;const r=new Set(e.map(a=>a.toLowerCase()));return t.filter(a=>r.has(a.relativePath.toLowerCase()))},qt=(t,e)=>{const r=Pt(e);return t.map(a=>{const i=r[`${a.section}.${a.key}`]||"";return{...a,value:a.sensitive?i?"已设置":"":i}})},Pt=t=>{const e={};let r="";for(const a of t.split(/\r?\n/)){const i=a.trim();if(!i||i.startsWith(";")||i.startsWith("#"))continue;if(i.startsWith("[")&&i.endsWith("]")){r=i.slice(1,-1).trim();continue}const n=i.indexOf("=");if(n<0||!r)continue;const o=i.slice(0,n).trim(),l=i.slice(n+1).trim();e[`${r}.${o}`]=l}return e},p=(t,e,r,a=!1)=>{const i=d(t).querySelector(`[data-role="${e}"]`);i&&(i.classList.toggle("error",a),i.textContent=r)},y=(t,e,r)=>{const a=d(t).querySelector(`[data-role="${e}"]`);if(a){if(r.length===0){a.innerHTML="";return}a.innerHTML=r.map(i=>`
    <div class="meta-item">
      <strong>${c(i.label)}</strong>
      <span>${c(i.value||"-")}</span>
    </div>
  `).join("")}},L=(t,e)=>{const r=d(t).querySelector('[data-role="settings-fields"]');if(r){if(e.length===0){r.innerHTML="";return}r.innerHTML=e.map(a=>`
    <label>
      <strong>${c(a.label)}</strong>
      <input value="${c(a.value)}" readonly />
      <span>${c(a.validator)}</span>
    </label>
  `).join("")}},q=(t,e)=>{const r=d(t).querySelector('[data-role="logs"]');r&&(r.textContent=e)},J=t=>{var r;const e=((r=t.context)==null?void 0:r.serverInstanceId)||"";if(!e)throw new Error("server instance context is required");return e},T=t=>(t instanceof Error?t.message:String(t||"file request failed")).slice(0,180),Tt=t=>new Promise(e=>window.setTimeout(e,t)),Q=t=>{const e=Number(t||0);return!Number.isFinite(e)||e<=0?"0 B":e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`},tt=t=>t.replace(/((?:password|token|secret)\s*=\s*)(.+)/gi,"$1[redacted]"),Et=t=>{if(t.key==="database")return{template:"players.summary"}},et=(t,e)=>({...w(t,"unavailable"),...e,unavailable:{...w(t,"unavailable").unavailable,...(e==null?void 0:e.unavailable)||{}}}),rt=(t,e)=>{const r=e instanceof Error?e.message:String(e||"plugin api request failed");return{...w(t,r.includes("403")?"denied":"failed"),error:{code:"api_error",message:r.slice(0,180)},unavailable:{code:"api_error",reasonCode:"api_error",summary:r.slice(0,180),nextAction:t.unavailable.nextAction}}},h=t=>t.state==="available"||t.state==="empty"||t.state==="pending_dispatch",S=(t,e)=>{var r,a,i;return h(e)?"":`
    <div class="notice ${e.state==="denied"?"error":""}">
      <strong>${c(((r=e.unavailable)==null?void 0:r.reasonCode)||t.unavailable.reasonCode)}</strong>
      <p>${c(((a=e.unavailable)==null?void 0:a.summary)||t.unavailable.summary)}</p>
      <p>${c(((i=e.unavailable)==null?void 0:i.nextAction)||t.unavailable.nextAction)}</p>
    </div>
  `},Ct=t=>t.state==="available"||t.state==="empty"||t.state==="pending_dispatch"?"ok":t.state==="denied"||t.state==="failed"?"error":"warn",It=(t,e)=>e.state==="loading"?"加载中":t.migrationStatus==="not_migrated"?"未迁移":t.migrationStatus==="deferred"?"延后":e.state==="pending_dispatch"?"已提交":h(e)?t.migrationStatus==="partial"?"部分可用":"可用":e.state==="denied"?"无权限":"暂不可用",O=(t,e)=>{var a,i,n;const r=((a=t.data)==null?void 0:a.rows)||((i=t.data)==null?void 0:i.items)||((n=t.data)==null?void 0:n.tasks);return Array.isArray(r)?r:e},at=t=>{var a;const e=(a=t.data)==null?void 0:a.source;return!e||typeof e!="object"?"":[e.kind,e.mode,e.summary].filter(i=>typeof i=="string"&&i.length>0).join(" / ")},Mt=t=>{var e,r;if(t.operation){const a=t.operation.id||t.operation.operationId||"operation",i=t.operation.status||t.state||"pending_dispatch",n=t.operation.summary||t.summary||"";return`${a} - ${i}${n?` - ${n}`:""}`}return((e=t.unavailable)==null?void 0:e.summary)||((r=t.error)==null?void 0:r.message)||"操作未能提交。"},P=(t,e)=>{const r=d(t).querySelector('[data-role="diff"]');r&&(r.textContent=e)},d=t=>t.content.querySelector('[data-role="route-body"]')||t.content,_t=t=>t.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`),c=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");dt();
