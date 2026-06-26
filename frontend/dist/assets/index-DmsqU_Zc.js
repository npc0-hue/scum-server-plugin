var fe=Object.defineProperty;var he=(e,t,r)=>t in e?fe(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var x=(e,t,r)=>he(e,typeof t!="symbol"?t+"":t,r);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))a(i);new MutationObserver(i=>{for(const n of i)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function r(i){const n={};return i.integrity&&(n.integrity=i.integrity),i.referrerPolicy&&(n.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?n.credentials="include":i.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function a(i){if(i.ep)return;i.ep=!0;const n=r(i);fetch(i.href,n)}})();const G="scum.plugin.bridge",K="1",ve="0.1.0";class xe{constructor(t,r,a){x(this,"contextValue",null);x(this,"pending",new Map);x(this,"contextListeners",new Set);x(this,"nonce",new URL(window.location.href).searchParams.get("bridgeNonce")||"");x(this,"handleMessage",t=>{const r=t.data;if(!(!r||r.protocol!==G||r.version!==K||r.nonce!==this.nonce)){if(r.type==="host.context"||r.type==="host.context.update"){this.contextValue=r.payload,this.contextListeners.forEach(a=>a(this.contextValue));return}if(r.type==="host.api.response"){const a=this.pending.get(r.requestId);if(!a)return;clearTimeout(a.timeout),this.pending.delete(r.requestId);const i=r.payload;i!=null&&i.error?a.reject(ke(i.error.code,i.error.message||i.error.code||"api error")):a.resolve(i==null?void 0:i.body)}}});this.pluginId=t,this.pluginVersion=r,this.routeKey=a}get context(){return this.contextValue}onContext(t){return this.contextListeners.add(t),this.contextValue&&t(this.contextValue),()=>this.contextListeners.delete(t)}init(){return window.addEventListener("message",this.handleMessage),this.send("plugin.handshake",{sdkVersion:ve}),new Promise((t,r)=>{const a=setTimeout(()=>r(new Error("bridge timeout")),1e4),i=()=>{this.contextValue?(clearTimeout(a),t(this.contextValue)):setTimeout(i,20)};i()})}ready(t={}){this.send("plugin.ready",{metadata:t})}error(t){const r=t instanceof Error?t.message:String(t||"plugin error");this.send("plugin.error",{code:"scum_admin_error",message:r.slice(0,240)})}height(t){this.send("plugin.height",{height:t})}api(t,r="GET",a){const i=Z("api");return this.send("plugin.api.request",{path:t,method:r,body:a},i),new Promise((n,o)=>{const s=setTimeout(()=>{this.pending.delete(i),o(new Error("api timeout"))},1e4);this.pending.set(i,{resolve:n,reject:o,timeout:s})})}send(t,r,a=Z("msg")){var i;window.parent.postMessage({protocol:G,version:K,type:t,requestId:a,traceId:(i=this.contextValue)==null?void 0:i.traceId,nonce:this.nonce,pluginId:this.pluginId,pluginVersion:this.pluginVersion,routeKey:this.routeKey,payload:r},"*")}}const ke=(e,t)=>{const r=new Error(t);return r.code=e||"api_error",r},Z=e=>`${e}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`,m=(e,t,r,a="请刷新服务器状态，或联系具备管理权限的协作者处理。")=>({capability:e,reasonCode:t,summary:r,nextAction:a}),S=[{key:"settings",title:"SCUM 配置",path:"/settings",method:"GET",apiPath:"settings",permissions:["scum.config.read"],capability:"file.read",riskLevel:"medium",summary:"列出 WindowsServer 配置目录中的真实文件，并支持完整的 SCUM 常用配置文件读取。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("file.read","file_capability_unavailable","配置文件读取能力暂不可用。")},{key:"database",title:"数据库视图",path:"/database",method:"POST",apiPath:"database/query",permissions:["scum.database.query"],capability:"db.query",riskLevel:"medium",summary:"提交只读 SCUM.db 查询计划，由绑定 run 执行端返回有界结果。",domainOwner:"plugins/scum-admin backend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_direct_only","数据库视图已作为玩家等业务页的数据来源，独立查询页暂不作为日常入口。")},{key:"players",title:"玩家",path:"/players",method:"GET",apiPath:"players",permissions:["scum.players.read"],capability:"db.query",riskLevel:"medium",summary:"玩家列表、搜索、登录历史和权限感知操作入口。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("db.query","database_capability_unavailable","玩家数据需要绑定执行端提供只读数据库能力。")},{key:"vehicles",title:"载具",path:"/vehicles",method:"GET",apiPath:"vehicles",permissions:["scum.vehicles.read"],capability:"db.query",riskLevel:"medium",summary:"载具列表、归属和状态视图。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_capability_unavailable","载具数据需要绑定执行端提供只读数据库能力。")},{key:"territories",title:"领地",path:"/territories",method:"GET",apiPath:"territories",permissions:["scum.territories.read"],capability:"db.query",riskLevel:"medium",summary:"领地、区域、小队和地图资源视图。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_capability_unavailable","领地、区域和小队数据需要绑定执行端提供只读数据库能力。")},{key:"locks",title:"开锁",path:"/locks",method:"GET",apiPath:"locks",permissions:["scum.locks.read"],capability:"db.query",riskLevel:"medium",summary:"锁具和开锁记录视图。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"partial",visibility:"direct",unavailable:m("db.query","database_capability_unavailable","锁具和开锁记录数据需要绑定执行端提供只读数据库能力。")},{key:"gifts",title:"礼包",path:"/gifts",method:"GET",apiPath:"gifts",permissions:["scum.gifts.read"],capability:"task.query",riskLevel:"medium",summary:"礼包规则、发放记录和统计。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"not_migrated",visibility:"direct",unavailable:m("task.query","not_migrated","礼包管理需要完整发放和审计链路，当前批次暂不开放。")},{key:"events",title:"事件",path:"/events",method:"GET",apiPath:"events",permissions:["scum.events.read"],capability:"task.query",riskLevel:"medium",summary:"事件规则、活动配置和事件产物。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"not_migrated",visibility:"direct",unavailable:m("task.query","not_migrated","事件管理仍在迁移，当前仅保留直接不可用页。")},{key:"economy",title:"交易物品",path:"/economy",method:"GET",apiPath:"economy/items",permissions:["scum.economy.read"],capability:"artifact.read",riskLevel:"low",summary:"交易物品常量、价格分类和插件自有图片资源。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"not_migrated",visibility:"direct",unavailable:m("artifact.read","not_migrated","交易物品资源已归插件所有，经济管理页暂未迁移。")},{key:"logs",title:"日志",path:"/logs",method:"GET",apiPath:"logs",permissions:["scum.logs.read"],capability:"file.read",riskLevel:"medium",summary:"列出 SCUM 日志目录中的真实文件，并按受控上限读取最新内容。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("file.read","file_capability_unavailable","日志读取需要绑定执行端提供文件目录与文件读取能力。")},{key:"steam",title:"Steam",path:"/steam",method:"GET",apiPath:"steam/news",permissions:["scum.steam.read"],capability:"steam.news",riskLevel:"low",summary:"Steam 新闻、版本元数据和发布提示。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"deferred",visibility:"direct",unavailable:m("steam.news","deferred","Steam 新闻和版本面板已记录但不属于首批日常管理入口。")},{key:"update",title:"更新与重启",path:"/update",method:"POST",apiPath:"update/server",permissions:["scum.update.mutate","scum.restart.mutate"],capability:"steamcmd.update",riskLevel:"high",summary:"SteamCMD 安装、服务端更新和受控重启任务。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("steamcmd.update","update_capability_unavailable","更新与重启需要可用的任务、进程和 SteamCMD 能力。")},{key:"tasks",title:"任务",path:"/tasks",method:"GET",apiPath:"tasks",permissions:["scum.tasks.read"],capability:"task.query",riskLevel:"medium",summary:"SCUM 插件任务状态、结果摘要和稳定错误。",domainOwner:"plugins/scum-admin/frontend",migrationStatus:"migrated",visibility:"normal",unavailable:m("task.query","task_capability_unavailable","任务列表需要任务状态查询能力。")}];S.filter(e=>e.migrationStatus==="migrated").map(e=>e.key);const _=S.filter(e=>e.visibility==="normal"),O=e=>S.find(t=>t.key===e)||S[0],Q="scum-admin",we="0.1.13",Se=e=>{try{const t=new URL(e).pathname.split("/").filter(Boolean),r=t.findIndex(a=>a==="plugin-assets");if(r>=0&&t[r+1]===Q&&t[r+2])return decodeURIComponent(t[r+2])}catch{}return we},$e=[{section:"SCUM.Server",key:"MaxPlayers",label:"最大玩家数",validator:"1-256"},{section:"SCUM.Server",key:"ServerName",label:"服务器名称",validator:"1-128 字符"}],$=(e,t="unavailable")=>({kind:"unavailable",state:t,route:e.key,domain:e.key,title:e.title,summary:e.summary,unavailable:{code:e.unavailable.reasonCode,reasonCode:e.unavailable.reasonCode,summary:e.unavailable.summary,nextAction:e.unavailable.nextAction}}),Le=`
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
    --plugin-shadow-soft: 0 16px 36px rgba(0, 0, 0, 0.16);
    --plugin-workspace-bg-image: none;
    min-height: 100%;
    padding: 24px;
    color: var(--plugin-text);
    background: transparent;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
    position: relative;
  }

  .scum-admin-plugin::before {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: "";
    z-index: 0;
    opacity: 0;
    background-image: var(--plugin-workspace-bg-image);
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    transition: opacity 0.2s ease;
  }

  .scum-admin-plugin.has-backdrop::before {
    opacity: 1;
  }

  .scum-admin-plugin > * {
    position: relative;
    z-index: 1;
  }

  .scum-admin-plugin::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: "";
    z-index: 0;
    background:
      linear-gradient(180deg, rgba(5, 7, 12, 0.38), rgba(5, 7, 12, 0.58)),
      linear-gradient(135deg, color-mix(in srgb, var(--plugin-primary) 20%, transparent), transparent 42%, color-mix(in srgb, var(--plugin-info) 14%, transparent));
  }

  .scum-admin-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    padding: 18px 20px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.03)),
      color-mix(in srgb, var(--plugin-panel-strong) 88%, transparent);
    backdrop-filter: blur(22px) saturate(1.22);
    -webkit-backdrop-filter: blur(22px) saturate(1.22);
    box-shadow: var(--plugin-shadow-soft);
  }

  .scum-admin-header h1 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 24px;
    font-weight: 720;
  }

  .scum-admin-header p {
    max-width: 760px;
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
    margin: 18px 0;
    padding: 6px;
    border: 1px solid var(--plugin-border);
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      color-mix(in srgb, var(--plugin-panel) 88%, transparent);
    backdrop-filter: blur(18px) saturate(1.18);
    -webkit-backdrop-filter: blur(18px) saturate(1.18);
  }

  .scum-admin-tabs button {
    min-height: 38px;
    padding: 8px 12px;
    border: 1px solid var(--plugin-border);
    border-radius: 12px;
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
    padding: 0;
    border: 0;
    background: transparent;
  }

  .route-shell {
    display: grid;
    gap: 18px;
    padding: 22px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)),
      color-mix(in srgb, var(--plugin-panel-strong) 90%, transparent);
    backdrop-filter: blur(22px) saturate(1.2);
    -webkit-backdrop-filter: blur(22px) saturate(1.2);
    box-shadow: var(--plugin-shadow);
  }

  .surface-body {
    display: grid;
    gap: 16px;
  }

  .surface-title {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .surface-title > div {
    display: grid;
    gap: 8px;
  }

  .surface-title h2 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 20px;
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

  .surface-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--plugin-muted);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .surface-eyebrow::before {
    width: 28px;
    height: 1px;
    background: color-mix(in srgb, var(--plugin-primary) 54%, transparent);
    content: "";
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
    margin: 0;
  }

  .controls-stack {
    display: grid;
    gap: 10px;
    align-items: stretch;
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
    margin: 0;
    padding: 12px 14px;
    border: 1px solid rgba(255, 176, 32, 0.45);
    border-radius: 12px;
    color: #ffd37a;
    background: rgba(255, 176, 32, 0.1);
    line-height: 1.5;
  }

  .notice.compact {
    padding: 10px 12px;
    font-size: 13px;
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
    margin: 0;
  }

  .meta-grid--compact {
    grid-template-columns: 1fr;
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

  .workspace-grid {
    display: grid;
    grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .workspace-sidebar,
  .workspace-main {
    display: grid;
    gap: 16px;
  }

  .workspace-card {
    display: grid;
    gap: 14px;
    padding: 18px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)),
      color-mix(in srgb, var(--plugin-panel) 90%, transparent);
    backdrop-filter: blur(18px) saturate(1.16);
    -webkit-backdrop-filter: blur(18px) saturate(1.16);
    box-shadow: var(--plugin-shadow-soft);
  }

  .workspace-card--primary {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--plugin-primary) 16%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.025)),
      color-mix(in srgb, var(--plugin-panel) 90%, transparent);
  }

  .workspace-card-heading {
    display: grid;
    gap: 8px;
  }

  .workspace-card-heading strong {
    color: var(--plugin-text-strong);
    font-size: 18px;
  }

  .workspace-card-heading p {
    margin: 0;
    color: var(--plugin-muted);
    line-height: 1.6;
  }

  .workspace-card-heading .surface-eyebrow {
    letter-spacing: 0.12em;
  }

  .workspace-hint {
    display: grid;
    gap: 8px;
    color: var(--plugin-muted);
    line-height: 1.55;
  }

  .workspace-hint strong {
    color: var(--plugin-text-strong);
    font-size: 14px;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
    margin: 0;
  }

  .field-grid label {
    display: grid;
    gap: 6px;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    color: var(--plugin-muted);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      var(--plugin-panel);
    backdrop-filter: blur(16px) saturate(1.18);
    -webkit-backdrop-filter: blur(16px) saturate(1.18);
  }

  .field-grid strong {
    color: var(--plugin-text);
    font-size: 13px;
  }

  .field-grid span {
    color: var(--plugin-muted);
    font-size: 12px;
  }

  .settings-editor {
    display: grid;
    gap: 10px;
    margin-top: 0;
    padding: 18px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025)),
      var(--plugin-panel);
    backdrop-filter: blur(18px) saturate(1.2);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
    box-shadow: var(--plugin-shadow);
  }

  .settings-editor-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .settings-editor-header strong {
    color: var(--plugin-text-strong);
  }

  .settings-editor-header p {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    font-size: 13px;
  }

  .settings-editor textarea {
    width: 100%;
    min-height: clamp(360px, 58vh, 760px);
    resize: vertical;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    color: #dbeafe;
    background: rgba(6, 10, 20, 0.92);
    font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    outline: none;
    white-space: pre;
  }

  .settings-editor textarea:focus {
    border-color: var(--plugin-primary);
  }

  .settings-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .settings-mode {
    display: inline-flex;
    gap: 6px;
    padding: 4px;
    width: fit-content;
    border: 1px solid var(--plugin-border);
    border-radius: 999px;
    background: rgba(10, 14, 22, 0.38);
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
  }

  .settings-mode button {
    min-height: 30px;
    padding: 6px 10px;
    border: 0;
    border-radius: 999px;
    color: var(--plugin-muted);
    background: transparent;
    cursor: pointer;
    font: inherit;
  }

  .settings-mode button[aria-pressed="true"] {
    color: #ffffff;
    background: color-mix(in srgb, var(--plugin-primary) 18%, rgba(255, 255, 255, 0.08));
  }

  .settings-mode button:hover {
    color: #ffffff;
  }

  .settings-save-status {
    color: var(--plugin-muted);
    font-size: 13px;
  }

  .settings-frame {
    display: grid;
    gap: 16px;
  }

  .settings-structured-panel {
    display: grid;
    gap: 14px;
  }

  .settings-structured-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .settings-structured-header p {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    line-height: 1.55;
  }

  .settings-structured-header strong {
    color: var(--plugin-text-strong);
    font-size: 17px;
  }

  .settings-file-mark {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 4px 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 999px;
    color: var(--plugin-muted);
    background: rgba(255, 255, 255, 0.05);
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
    border-radius: 12px;
    color: var(--plugin-muted);
    background: rgba(255, 255, 255, 0.025);
    text-align: center;
  }

  .empty.inline {
    padding: 14px;
    text-align: left;
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
    .surface-title,
    .settings-structured-header,
    .settings-editor-header {
      display: grid;
    }

    .controls,
    .controls-stack,
    .workspace-grid {
      display: grid;
    }

    .controls input,
    .controls select,
    .controls button {
      width: 100%;
    }

    .scum-admin-plugin,
    .route-shell {
      padding: 16px;
    }
  }
`,Ce=async()=>{const e=document.getElementById("scum-admin-plugin-root")||document.body,t=new URL(window.location.href).searchParams.get("routeKey")||"settings",r=new xe(Q,Se(window.location.href),t),a=document.createElement("main");a.className="scum-admin-plugin",a.innerHTML=`
    <style>
      ${Le}
    </style>
    <header class="scum-admin-header">
      <div>
        <h1>SCUM 管理</h1>
        <p class="scum-admin-status" data-role="status">正在通过 host bridge 初始化...</p>
      </div>
    </header>
    <nav class="scum-admin-tabs" aria-label="SCUM 管理域" data-role="nav"></nav>
    <section class="route-surface" data-role="content"></section>
  `,e.appendChild(a),r.onContext(l=>qe(a,l));const i=a.querySelector('[data-role="status"]'),n=a.querySelector('[data-role="nav"]'),o=a.querySelector('[data-role="content"]');if(!i||!n||!o)return;const s={bridge:r,context:null,route:O(t),content:o,status:i,nav:n,settingsViewMode:"structured",settingsModeTouched:!1};z(s),y(s,{state:"loading",title:s.route.title,summary:s.route.summary});try{const l=await r.init();s.context=l,s.route=O(l.routeKey||t),i.textContent=`已连接 host bridge，当前实例：${l.serverInstanceId||"未选择"}`,z(s),await ee(s,s.route.key),r.ready({surface:s.route.key,routes:S.map(u=>u.key)}),r.height(document.documentElement.scrollHeight)}catch(l){const u=l instanceof Error?l.message:String(l);i.textContent=`host bridge 初始化失败：${u}`,r.error(l)}},qe=(e,t)=>{for(const[a,i]of Object.entries(t.themeTokens||{}))/^[a-zA-Z][a-zA-Z0-9]*$/.test(a)&&typeof i=="string"&&e.style.setProperty(`--plugin-theme-${nt(a)}`,i);const r=typeof t.backdropImage=="string"?t.backdropImage.trim():"";if(r){e.style.setProperty("--plugin-workspace-bg-image",`url("${r}")`),e.classList.add("has-backdrop");return}e.style.setProperty("--plugin-workspace-bg-image","none"),e.classList.remove("has-backdrop")},z=e=>{const t=Pe(e.route);e.nav.innerHTML=t.map(r=>`
    <button type="button" data-route="${r.key}" data-status="${r.migrationStatus}" aria-current="${r.key===e.route.key?"page":"false"}">
      ${c(r.title)}
    </button>
  `).join(""),e.nav.querySelectorAll("button").forEach(r=>{r.addEventListener("click",()=>{ee(e,r.dataset.route||"settings")})})},Pe=e=>_.some(t=>t.key===e.key)?_:[e,..._],ee=async(e,t)=>{if(e.route=O(t),z(e),y(e,{state:"loading",title:e.route.title,summary:e.route.summary}),e.route.migrationStatus==="not_migrated"||e.route.migrationStatus==="deferred"){te(e,$(e.route,e.route.migrationStatus));return}if(e.route.key==="update"){je(e,$(e.route,"available"));return}try{const r=await e.bridge.api(Ee(e.route.apiPath),e.route.method,Qe(e.route));X(e,j(e.route,r))}catch(r){X(e,me(e.route,r))}},Ee=e=>`/api/plugins/scum-admin/${String(e||"").replace(/^\/+/,"")}`,y=(e,t)=>{var n;const r=e.route,a=at(t),i=v(t)?r.summary:((n=t.unavailable)==null?void 0:n.summary)||r.unavailable.summary;e.content.innerHTML=`
    <div class="route-shell">
      <div class="surface-title">
        <div>
          <span class="surface-eyebrow">${c(r.domainOwner||"plugin workspace")}</span>
          <h2>${c(r.title)}</h2>
          <p>${c(i)}</p>
        </div>
        <span class="status-pill" data-tone="${a}">${it(r,t)}</span>
      </div>
      <div data-role="route-body"><div class="empty">正在加载 ${c(r.title)}...</div></div>
    </div>
  `},X=(e,t)=>{switch(e.route.key){case"settings":Me(e,t);return;case"players":Te(e,t);return;case"vehicles":A(e,t,{empty:"暂无载具数据。",columns:[{key:"id",label:"载具 ID"},{key:"vehicleType",label:"载具类型"},{key:"ownerPrisonerId",label:"归属玩家"},{key:"locationX",label:"X"},{key:"locationY",label:"Y"},{key:"locationZ",label:"Z"}]});return;case"territories":A(e,t,{empty:"暂无领地或小队数据。",columns:[{key:"territoryId",label:"领地 ID"},{key:"ownerName",label:"归属角色"},{key:"ownerSteamId",label:"SteamID"},{key:"squadName",label:"所属小队"},{key:"locationX",label:"X"},{key:"locationY",label:"Y"}]});return;case"locks":A(e,t,{empty:"暂无锁具数据。",columns:[{key:"id",label:"锁具 ID"},{key:"lockType",label:"锁具类型"},{key:"ownerPrisonerId",label:"归属玩家"},{key:"locationX",label:"X"},{key:"locationY",label:"Y"},{key:"locationZ",label:"Z"}]});return;case"logs":_e(e,t);return;case"tasks":De(e,t);return;case"database":Ie(e,t);return;default:te(e,t)}},te=(e,t)=>{var r,a;y(e,t),d(e).innerHTML=`
    <div class="notice">
      <strong>${c(pe(e.route,t))}</strong>
      <p>${c(((r=t.unavailable)==null?void 0:r.summary)||e.route.unavailable.summary)}</p>
      <p>${c(((a=t.unavailable)==null?void 0:a.nextAction)||e.route.unavailable.nextAction)}</p>
      ${ge(t)}
    </div>
  `},Ie=(e,t)=>{y(e,t),d(e).innerHTML=`
    <div class="notice">
      数据库独立查询页当前只作为直接访问的迁移占位。玩家、日志等业务页会通过插件后端使用受控查询模板。
    </div>
  `},Me=(e,t)=>{var l,u,b,f,h,V,B,H,N,W;y(e,t),e.settingsModeTouched=!1;const r=!v(t),a=Array.isArray((l=t.data)==null?void 0:l.workspaces)?t.data.workspaces:[],i=Array.isArray((u=t.data)==null?void 0:u.supportedFiles)?t.data.supportedFiles.filter(P=>typeof P=="string"):[],n=Array.isArray((b=t.data)==null?void 0:b.structuredFields)?t.data.structuredFields:$e,o=typeof((f=t.data)==null?void 0:f.structuredPath)=="string"?t.data.structuredPath:"";if(d(e).innerHTML=`
    ${q(e.route,t)}
    <div class="workspace-grid settings-frame">
      <aside class="workspace-sidebar">
        <section class="workspace-card workspace-card--primary">
          <div class="workspace-card-heading">
            <span class="surface-eyebrow">Config Workspace</span>
            <strong>配置工作区</strong>
            <p>优先打开 ServerSettings.ini 并停留在配置模式，需要时再切到文件模式查看原始内容。</p>
          </div>
          <div class="controls-stack">
            <select data-role="settings-workspace" ${r?"disabled":""}>
              ${a.map(P=>`
                <option value="${c(P.key)}">${c(P.title)}</option>
              `).join("")}
            </select>
            <select data-role="settings-file" ${r?"disabled":""}></select>
            <button type="button" class="action-button" data-action="reload-settings" ${r?"disabled":""}>重新读取配置</button>
          </div>
          <div class="notice compact" data-role="settings-status">等待读取配置目录。</div>
          <div class="meta-grid meta-grid--compact">
            <div class="meta-item">
              <strong>当前文件</strong>
              <span data-role="settings-current-file">未选择</span>
            </div>
            <div class="meta-item">
              <strong>当前模式</strong>
              <span data-role="settings-mode-note">配置模式</span>
            </div>
          </div>
        </section>

        <section class="workspace-card">
          <div class="workspace-card-heading">
            <span class="surface-eyebrow">View Mode</span>
            <strong>查看方式</strong>
          </div>
          <div class="settings-mode" role="group" aria-label="配置查看模式">
            <button type="button" data-settings-mode="structured" aria-pressed="true">配置模式</button>
            <button type="button" data-settings-mode="raw" aria-pressed="false">文件模式</button>
          </div>
          <div class="workspace-hint">
            <strong>推荐顺序</strong>
            <span>平时修改参数走配置模式，字段更清楚；只有排查原文、复制片段或处理未结构化文件时再进入文件模式。</span>
          </div>
        </section>
      </aside>

      <div class="workspace-main">
        <section class="workspace-card settings-structured-panel" data-role="settings-structured-panel">
          <div class="settings-structured-header">
            <div>
              <strong>结构化配置</strong>
              <p>这里聚焦当前文件里最常改、最容易出错的服务器参数。字段直接回写到右侧原始文件编辑区。</p>
            </div>
            <span class="settings-file-mark" data-role="settings-file-label">未选择文件</span>
          </div>
          <div class="field-grid" data-role="settings-fields"></div>
        </section>

        <section class="settings-editor" data-role="settings-editor-panel">
          <div class="settings-editor-header">
            <div>
              <strong>原始文件</strong>
              <p>保留完整文本视图，适合核对差异、处理暂未结构化的配置项，或直接做一次性调整。</p>
            </div>
            <span class="settings-save-status" data-role="settings-save-status"></span>
          </div>
          <textarea data-role="settings-editor" spellcheck="false"></textarea>
          <div class="settings-actions">
            <button type="button" class="action-button" data-action="save-settings" disabled>提交修改</button>
            <button type="button" class="action-button secondary" data-action="reset-settings" disabled>还原</button>
          </div>
        </section>
      </div>
    </div>
  `,r||a.length===0)return;Fe(e);const s=()=>{Ae(e,a,i,n,o)};(h=d(e).querySelector('[data-action="reload-settings"]'))==null||h.addEventListener("click",s),(V=d(e).querySelector('[data-role="settings-workspace"]'))==null||V.addEventListener("change",s),(B=d(e).querySelector('[data-role="settings-file"]'))==null||B.addEventListener("change",()=>{re(e,n,o)}),(H=d(e).querySelector('[data-action="save-settings"]'))==null||H.addEventListener("click",()=>{Oe(e,o)}),(N=d(e).querySelector('[data-action="reset-settings"]'))==null||N.addEventListener("click",()=>ze(e,n,o)),(W=d(e).querySelector('[data-role="settings-editor"]'))==null||W.addEventListener("input",()=>T(e,n,o)),F(e,e.settingsViewMode),s()},Te=(e,t)=>{var n,o;y(e,t);const r=!v(t),a=D(t,[{id:"sample-1",name:"Prisoner One",steamId:"7656******0001",lastSeen:"待执行端返回",status:r?"不可用":"在线"}]),i=be(t);d(e).innerHTML=`
    ${q(e.route,t)}
    ${i?`<div class="notice"><strong>数据来源</strong><p>${c(i)}</p></div>`:""}
    <div class="controls">
      <input type="search" data-role="player-search" placeholder="搜索玩家、SteamID 或状态" />
      <button type="button" class="action-button secondary" data-action="show-player-detail" ${a.length===0?"disabled":""}>查看详情</button>
      <button type="button" class="action-button secondary" disabled>踢出</button>
      <button type="button" class="action-button secondary" disabled>封禁</button>
      <button type="button" class="action-button secondary" disabled>发物品</button>
    </div>
    <div data-role="players-table">${J(a)}</div>
    <div class="task-row" data-role="player-detail">选择“查看详情”以显示当前第一名玩家的结构化详情占位。</div>
  `,(n=d(e).querySelector('[data-role="player-search"]'))==null||n.addEventListener("input",s=>{const l=s.target.value.toLowerCase(),u=a.filter(f=>Object.values(f).some(h=>String(h).toLowerCase().includes(l))),b=d(e).querySelector('[data-role="players-table"]');b&&(b.innerHTML=J(u))}),(o=d(e).querySelector('[data-action="show-player-detail"]'))==null||o.addEventListener("click",()=>{const s=d(e).querySelector('[data-role="player-detail"]');if(!s)return;const l=a[0]||{};s.innerHTML=`
      <strong>${c(String(l.name||l.id||"玩家详情"))}</strong>
      <p>SteamID: ${c(String(l.steamId||l.steamID||"-"))}</p>
      <p>状态: ${c(String(l.status||"-"))}</p>
      <p>最近活动: ${c(String(l.lastSeen||l.updatedAt||"-"))}</p>
      <details>
        <summary>查看结构化数据</summary>
        <pre>${c(JSON.stringify(l,null,2))}</pre>
      </details>
    `})},A=(e,t,r)=>{y(e,t);const a=be(t),i=!v(t),n=D(t,i?[]:[Be(r.columns)]);d(e).innerHTML=`
    ${q(e.route,t)}
    ${a?`<div class="notice"><strong>数据来源</strong><p>${c(a)}</p></div>`:""}
    ${Ve(n,r.columns,r.empty)}
  `},_e=(e,t)=>{var n,o,s,l;y(e,t);const r=!v(t),a=Array.isArray((n=t.data)==null?void 0:n.workspaces)?t.data.workspaces:[];if(d(e).innerHTML=`
    ${q(e.route,t)}
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
  `,r||a.length===0)return;const i=()=>{Re(e,a)};(o=d(e).querySelector('[data-action="reload-logs"]'))==null||o.addEventListener("click",i),(s=d(e).querySelector('[data-role="log-workspace"]'))==null||s.addEventListener("change",i),(l=d(e).querySelector('[data-role="log-file"]'))==null||l.addEventListener("change",()=>{ae(e)}),i()},Ae=async(e,t,r,a,i)=>{var s,l;const n=((s=d(e).querySelector('[data-role="settings-workspace"]'))==null?void 0:s.value)||((l=t[0])==null?void 0:l.key)||"",o=t.find(u=>u.key===n)||t[0];if(!o){p(e,"settings-status","未找到配置目录。",!0);return}p(e,"settings-status",`正在读取 ${o.title}...`);try{const u=se(o.directoryPath,await ie(e,o.directoryPath)),b=o.supportedFiles&&o.supportedFiles.length>0?o.supportedFiles:r,f=Ne(u,b),h=de(f,b);le(e,"settings-file",h,i||o.defaultFilePath),p(e,"settings-status",h.length>0?"配置目录已加载。":"未找到可读取的配置文件。",h.length===0),await re(e,a,i)}catch(u){p(e,"settings-status",C(u),!0),w(e,[]),E(e,"","","",a,i)}},re=async(e,t,r)=>{var i;const a=((i=d(e).querySelector('[data-role="settings-file"]'))==null?void 0:i.value)||"";if(!a){p(e,"settings-status","当前目录下没有可读取的配置文件。",!0),w(e,[]),E(e,"","","",t,r);return}p(e,"settings-status","正在读取配置...");try{const n=await ne(e,a),o=typeof n.content=="string"?n.content:"",s=ce(t,o,L(a,r));w(e,s),E(e,a,o,typeof n.checksum=="string"?n.checksum:"",t,r),e.settingsModeTouched||F(e,Ue(a,r,s)),p(e,"settings-status",n.truncated?"配置已读取，但内容被截断，暂不能提交修改。":"配置已加载。",!!n.truncated)}catch(n){p(e,"settings-status",C(n),!0),w(e,[]),E(e,"","","",t,r)}},Oe=async(e,t)=>{const r=d(e).querySelector('[data-role="settings-editor"]'),a=d(e).querySelector('[data-role="settings-save-status"]');if(!r||!a)return;const i=r.dataset.path||"",n=r.dataset.original||"",o=r.dataset.checksum||"";if(!L(i,t)){a.textContent="当前文件暂不支持提交修改。";return}if(r.value===n){a.textContent="没有需要提交的修改。";return}a.textContent="正在提交修改...";try{const s=R(e),l=await e.bridge.api(`/api/v1/scum/instances/${encodeURIComponent(s)}/config`,"PATCH",{serverInstanceId:s,expectedChecksum:o,rawContent:r.value}),u=j(e.route,l);a.textContent=ye(u)}catch(s){a.textContent=C(s)}},ze=(e,t,r)=>{const a=d(e).querySelector('[data-role="settings-editor"]');a&&(a.value=a.dataset.original||"",T(e,t,r))},T=(e,t,r)=>{const a=d(e).querySelector('[data-role="settings-editor"]'),i=d(e).querySelector('[data-action="save-settings"]'),n=d(e).querySelector('[data-action="reset-settings"]'),o=d(e).querySelector('[data-role="settings-save-status"]');if(!a)return;const s=a.value!==(a.dataset.original||""),l=s&&L(a.dataset.path||"",r)&&!!a.dataset.checksum;i&&(i.disabled=!l),n&&(n.disabled=!s),o&&s&&(o.textContent=""),w(e,ce(t,a.value,L(a.dataset.path||"",r)))},E=(e,t,r,a,i,n)=>{const o=d(e).querySelector('[data-role="settings-editor"]'),s=d(e).querySelector('[data-role="settings-file-label"]'),l=d(e).querySelector('[data-role="settings-save-status"]');o&&(o.value=r,o.dataset.original=r,o.dataset.path=t,o.dataset.checksum=a,o.dataset.structuredPath=n,s&&(s.textContent=t?k(t):""),ue(e,"settings-current-file",t||"未选择"),l&&(l.textContent=""),T(e,i,n))},Fe=e=>{d(e).querySelectorAll("button[data-settings-mode]").forEach(t=>{t.addEventListener("click",()=>{F(e,t.dataset.settingsMode==="raw"?"raw":"structured",!0)})})},F=(e,t,r=!1)=>{r&&(e.settingsModeTouched=!0),e.settingsViewMode=t;const a=d(e).querySelector('[data-role="settings-fields"]'),i=d(e).querySelector('[data-role="settings-structured-panel"]'),n=d(e).querySelector('[data-role="settings-editor-panel"]');d(e).querySelectorAll("button[data-settings-mode]").forEach(o=>{o.setAttribute("aria-pressed",o.dataset.settingsMode===t?"true":"false")}),i&&(i.hidden=t!=="structured"),a&&(a.hidden=t!=="structured"),n&&(n.hidden=t!=="raw"),ue(e,"settings-mode-note",t==="structured"?"配置模式":"文件模式")},Ue=(e,t,r)=>g(e)===g(t)?"structured":"raw",Re=async(e,t)=>{var i,n;const r=((i=d(e).querySelector('[data-role="log-workspace"]'))==null?void 0:i.value)||((n=t[0])==null?void 0:n.key)||"",a=t.find(o=>o.key===r)||t[0];if(!a){p(e,"logs-status","未找到日志目录。",!0);return}p(e,"logs-status",`正在读取 ${a.title}...`);try{const o=se(a.directoryPath,await ie(e,a.directoryPath));le(e,"log-file",de(o,a.preferredFiles||[])),p(e,"logs-status",`${a.title} 已加载，共 ${o.length} 个文件。`),await ae(e)}catch(o){p(e,"logs-status",C(o),!0),I(e,"logs-meta",[]),M(e,"暂无日志结果。")}},ae=async e=>{var r;const t=((r=d(e).querySelector('[data-role="log-file"]'))==null?void 0:r.value)||"";if(!t){p(e,"logs-status","当前目录下没有可读取的日志文件。",!0),I(e,"logs-meta",[]),M(e,"暂无日志结果。");return}p(e,"logs-status",`正在读取 ${t}...`);try{const a=await ne(e,t),i=typeof a.content=="string"?a.content:"";I(e,"logs-meta",[{label:"文件路径",value:t},{label:"校验和",value:typeof a.checksum=="string"?a.checksum:"-"},{label:"文件大小",value:Ye(a.sizeBytes)},{label:"截断状态",value:a.truncated?`已截断，偏移 ${a.readOffset||0}`:"完整"}]),M(e,Je(i)||"日志文件为空。"),p(e,"logs-status",`${t} 已加载。`)}catch(a){p(e,"logs-status",C(a),!0),I(e,"logs-meta",[]),M(e,"暂无日志结果。")}},je=(e,t)=>{y(e,t),d(e).innerHTML=`
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
  `,Y(e,"update-server","update/server"),Y(e,"restart-server","server/restart")},De=(e,t)=>{y(e,t);const r=!v(t),a=D(t,[{id:"pending-dispatch",type:"plugin-operation",status:r?"不可用":"等待执行端",summary:"等待插件任务状态能力返回结果"}]);d(e).innerHTML=`
    ${q(e.route,t)}
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
  `},Y=(e,t,r)=>{var a;(a=d(e).querySelector(`[data-action="${t}"]`))==null||a.addEventListener("click",async()=>{var s;const i=((s=d(e).querySelector('[data-role="confirm-update"]'))==null?void 0:s.checked)||!1,n=d(e).querySelector('[data-role="operation-result"]');if(!i){n&&(n.textContent="请先确认维护窗口。");return}n&&(n.textContent="正在提交 operation handle...");const o=await e.bridge.api(r,"POST",{confirmed:!0,action:t}).catch(l=>me(e.route,l));n&&(n.textContent=ye(j(e.route,o)))})},J=e=>e.length===0?'<div class="empty">没有匹配的玩家。</div>':`
    <table>
      <thead><tr><th>玩家</th><th>SteamID</th><th>状态</th><th>最近活动</th></tr></thead>
      <tbody>
        ${e.map(t=>`
          <tr>
            <td>${c(String(t.name||t.id||"-"))}</td>
            <td>${c(String(t.steamId||t.steamID||"-"))}</td>
            <td>${c(String(t.status||"-"))}</td>
            <td>${c(String(t.lastSeen||t.updatedAt||"-"))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `,Ve=(e,t,r)=>e.length===0?`<div class="empty">${c(r)}</div>`:`
    <table>
      <thead><tr>${t.map(a=>`<th>${c(a.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${e.map(a=>`
          <tr>${t.map(i=>`<td>${c(String(a[i.key]??"-"))}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `,Be=e=>{const t={};for(const r of e)t[r.key]=`待返回${r.label}`;return t},ie=async(e,t)=>{var n;const r=R(e),a=await U(e,`/api/v1/server-instances/${encodeURIComponent(r)}/files?path=${encodeURIComponent(t)}`),i=await oe(e,a.operation.id);return He((n=i.result)==null?void 0:n.entries)},ne=async(e,t)=>{var n,o,s,l,u;const r=R(e),a=await U(e,`/api/v1/server-instances/${encodeURIComponent(r)}/files/read`,"POST",{path:t,contentMode:"text"}),i=await oe(e,a.operation.id);return{content:(n=i.result)==null?void 0:n.content,checksum:(o=i.result)==null?void 0:o.checksum,sizeBytes:Number(((s=i.result)==null?void 0:s.sizeBytes)||0),truncated:!!((l=i.result)!=null&&l.truncated),readOffset:Number(((u=i.result)==null?void 0:u.readOffset)||0)}},U=async(e,t,r="GET",a)=>await e.bridge.api(t,r,a),oe=async(e,t)=>{for(let r=0;r<30;r+=1){const a=await U(e,`/api/v1/file-operations/${encodeURIComponent(t)}`);if(a.status==="succeeded")return a;if(a.status==="failed"||a.status==="rejected"||a.status==="conflicted")throw new Error(a.errorMessage||a.errorCode||"file operation failed");await Xe(300)}throw new Error("file operation timed out")},He=e=>Array.isArray(e)?e.filter(t=>!!(t&&typeof t=="object"&&typeof t.relativePath=="string")).filter(t=>!t.directory):[],se=(e,t)=>t.map(r=>{const a=g(r.relativePath);return{...r,name:r.name||k(a),relativePath:Ge(a,e)?a:We(e,a)}}),le=(e,t,r,a)=>{var s,l;const i=d(e).querySelector(`[data-role="${t}"]`);if(!i)return;const n=g(a||""),o=((s=r.find(u=>L(u.relativePath,n)||k(u.relativePath).toLowerCase()===k(n).toLowerCase()))==null?void 0:s.relativePath)||((l=r[0])==null?void 0:l.relativePath)||"";i.innerHTML=r.map(u=>`
    <option value="${c(u.relativePath)}"${u.relativePath===o?" selected":""}>${c(u.name)}</option>
  `).join("")},de=(e,t)=>{if(t.length===0)return e;const r=new Map;return t.forEach((a,i)=>{r.set(g(a).toLowerCase(),i),r.set(k(a).toLowerCase(),i)}),[...e].sort((a,i)=>{const n=r.get(g(a.relativePath).toLowerCase())??r.get(a.name.toLowerCase())??t.length+1,o=r.get(g(i.relativePath).toLowerCase())??r.get(i.name.toLowerCase())??t.length+1;return n===o?a.name.localeCompare(i.name):n-o})},Ne=(e,t)=>{if(t.length===0)return e;const r=new Set;for(const a of t)r.add(g(a).toLowerCase()),r.add(k(a).toLowerCase());return e.filter(a=>r.has(g(a.relativePath).toLowerCase())||r.has(a.name.toLowerCase()))},g=e=>String(e||"").replace(/\\+/g,"/").replace(/^\/+/,"").replace(/\/+/g,"/").trim(),We=(e,t)=>{const r=g(e),a=g(t);return r?a?`${r}/${a}`:r:a},Ge=(e,t)=>{const r=g(e).toLowerCase(),a=g(t).toLowerCase();return r===a||r.startsWith(`${a}/`)},L=(e,t)=>g(e).toLowerCase()===g(t).toLowerCase(),Ke=e=>{const t={};let r="";for(const a of e.split(/\r?\n/)){const i=a.trim();if(!i||i.startsWith(";")||i.startsWith("#"))continue;if(i.startsWith("[")&&i.endsWith("]")){r=i.slice(1,-1).trim();continue}const n=i.indexOf("=");if(n<0||!r)continue;const o=i.slice(0,n).trim(),s=i.slice(n+1).trim();t[`${r}.${o}`]=s}return t},p=(e,t,r,a=!1)=>{const i=d(e).querySelector(`[data-role="${t}"]`);i&&(i.classList.toggle("error",a),i.textContent=r)},I=(e,t,r)=>{const a=d(e).querySelector(`[data-role="${t}"]`);if(a){if(r.length===0){a.innerHTML="";return}a.innerHTML=r.map(i=>`
    <div class="meta-item">
      <strong>${c(i.label)}</strong>
      <span>${c(i.value||"-")}</span>
    </div>
  `).join("")}},w=(e,t)=>{const r=d(e).querySelector('[data-role="settings-fields"]');if(r){if(t.length===0){r.innerHTML='<div class="empty inline">当前文件没有可渲染的结构化配置项，可切换到文件模式直接查看原文。</div>';return}r.innerHTML=t.map(a=>`
    <label data-section="${c(a.section)}" data-key="${c(a.key)}">
      <strong>${c(a.label)}</strong>
      <input value="${c(a.value)}" ${a.editable?"":"readonly"} data-setting-section="${c(a.section)}" data-setting-key="${c(a.key)}" />
      <span>${c(a.validator)}</span>
    </label>
  `).join(""),r.querySelectorAll("input[data-setting-section]").forEach(a=>{a.addEventListener("input",()=>{const i=d(e).querySelector('[data-role="settings-editor"]');!i||a.readOnly||(i.value=Ze(i.value,a.dataset.settingSection||"",a.dataset.settingKey||"",a.value),T(e,t,i.dataset.structuredPath||""))})})}},ce=(e,t,r)=>{const a=new Map(e.map(o=>[`${o.section}.${o.key}`,o])),i=Ke(t),n=[];for(const[o,s]of Object.entries(i)){const l=a.get(o);if(l){n.push({...l,value:l.sensitive?s?"已设置":"":s,editable:r&&!l.sensitive});continue}const u=o.lastIndexOf(".");if(u<=0)continue;const b=o.slice(0,u),f=o.slice(u+1);n.push({section:b,key:f,label:f,validator:b,value:s,editable:r})}return n.slice(0,80)},Ze=(e,t,r,a)=>{const i=e.split(/\r?\n/);let n="";for(let o=0;o<i.length;o+=1){const s=i[o],l=s.trim();if(l.startsWith("[")&&l.endsWith("]")){n=l.slice(1,-1).trim();continue}if(n!==t||l.startsWith(";")||l.startsWith("#"))continue;const u=s.indexOf("=");if(!(u<0||s.slice(0,u).trim()!==r))return i[o]=`${s.slice(0,u+1)}${a}`,i.join(`
`)}return e},k=e=>{const t=e.split("/").filter(Boolean);return t[t.length-1]||e},M=(e,t)=>{const r=d(e).querySelector('[data-role="logs"]');r&&(r.textContent=t)},ue=(e,t,r)=>{const a=d(e).querySelector(`[data-role="${t}"]`);a&&(a.textContent=r)},R=e=>{var r;const t=((r=e.context)==null?void 0:r.serverInstanceId)||"";if(!t)throw new Error("server instance context is required");return t},C=e=>(e instanceof Error?e.message:String(e||"file request failed")).slice(0,180),Xe=e=>new Promise(t=>window.setTimeout(t,e)),Ye=e=>{const t=Number(e||0);return!Number.isFinite(t)||t<=0?"0 B":t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/(1024*1024)).toFixed(1)} MB`},Je=e=>e.replace(/((?:password|token|secret)\s*=\s*)(.+)/gi,"$1[redacted]"),Qe=e=>{if(e.key==="database")return{template:"players.summary"}},j=(e,t)=>({...$(e,"unavailable"),...t,unavailable:{...$(e,"unavailable").unavailable,...(t==null?void 0:t.unavailable)||{}}}),et=e=>{const t=e;return typeof(t==null?void 0:t.code)=="string"?t.code.trim():""},tt=e=>(e instanceof Error?e.message:String(e||"plugin api request failed")).trim().slice(0,180),rt=(e,t)=>{const r=et(t)||"api_error",a=tt(t);return r==="session_unavailable"||/plugin api gateway session is unavailable/i.test(a)?{state:"failed",reasonCode:"plugin_session_unavailable",summary:`${e.title} 当前无法连接到 SCUM 管理服务会话，通常是插件运行时、执行端或桥接会话尚未恢复。`,nextAction:"请先刷新服务器状态；如果仍未恢复，请让具备管理权限的协作者修复服务或重启 SCUM 管理插件。",code:r,message:a}:r==="unauthorized"||/platform session expired/i.test(a)?{state:"denied",reasonCode:"platform_session_expired",summary:"平台登录状态已过期，当前无法继续访问这个 SCUM 管理页面。",nextAction:"请重新登录平台后重试。",code:r,message:a}:r==="api_error"&&/api timeout|bridge timeout/i.test(a)?{state:"failed",reasonCode:"plugin_request_timeout",summary:`${e.title} 请求超时，当前服务没有在预期时间内返回结果。`,nextAction:"请刷新服务器状态后重试；如果多次超时，请让具备管理权限的协作者检查服务恢复状态。",code:r,message:a}:{state:a.includes("403")?"denied":"failed",reasonCode:e.unavailable.reasonCode,summary:e.unavailable.summary,nextAction:e.unavailable.nextAction,code:r,message:a}},pe=(e,t)=>{var a;const r=((a=t.unavailable)==null?void 0:a.reasonCode)||e.unavailable.reasonCode;return r==="platform_session_expired"?"登录状态已过期":r==="plugin_request_timeout"?`${e.title} 响应超时`:`${e.title} 当前不可用`},ge=e=>{var r,a,i,n;const t=(a=(r=e.error)==null?void 0:r.message)==null?void 0:a.trim();return t?`
    <details class="diagnostic-details">
      <summary>查看诊断信息</summary>
      <p><strong>错误码</strong> ${c(((i=e.error)==null?void 0:i.code)||((n=e.unavailable)==null?void 0:n.code)||"api_error")}</p>
      <p><strong>详情</strong> ${c(t)}</p>
    </details>
  `:""},me=(e,t)=>{const r=rt(e,t);return{...$(e,r.state),error:{code:r.code,message:r.message},unavailable:{code:r.code,reasonCode:r.reasonCode,summary:r.summary,nextAction:r.nextAction}}},v=e=>e.state==="available"||e.state==="empty"||e.state==="pending_dispatch",q=(e,t)=>{var r,a;return v(t)?"":`
    <div class="notice ${t.state==="denied"?"error":""}">
      <strong>${c(pe(e,t))}</strong>
      <p>${c(((r=t.unavailable)==null?void 0:r.summary)||e.unavailable.summary)}</p>
      <p>${c(((a=t.unavailable)==null?void 0:a.nextAction)||e.unavailable.nextAction)}</p>
      ${ge(t)}
    </div>
  `},at=e=>e.state==="available"||e.state==="empty"||e.state==="pending_dispatch"?"ok":e.state==="denied"||e.state==="failed"?"error":"warn",it=(e,t)=>t.state==="loading"?"加载中":e.migrationStatus==="not_migrated"?"未迁移":e.migrationStatus==="deferred"?"延后":t.state==="pending_dispatch"?"已提交":v(t)?e.migrationStatus==="partial"?"部分可用":"可用":t.state==="denied"?"无权限":"暂不可用",D=(e,t)=>{var a,i,n;const r=((a=e.data)==null?void 0:a.rows)||((i=e.data)==null?void 0:i.items)||((n=e.data)==null?void 0:n.tasks);return Array.isArray(r)?r:t},be=e=>{var a;const t=(a=e.data)==null?void 0:a.source;return!t||typeof t!="object"?"":[t.kind,t.mode,t.summary].filter(i=>typeof i=="string"&&i.length>0).join(" / ")},ye=e=>{var t,r;if(e.operation){const a=e.operation.id||e.operation.operationId||"operation",i=e.operation.status||e.state||"pending_dispatch",n=e.operation.summary||e.summary||"";return`${a} - ${i}${n?` - ${n}`:""}`}return((t=e.unavailable)==null?void 0:t.summary)||((r=e.error)==null?void 0:r.message)||"操作未能提交。"},d=e=>e.content.querySelector('[data-role="route-body"]')||e.content,nt=e=>e.replace(/[A-Z]/g,t=>`-${t.toLowerCase()}`),c=e=>String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");Ce();
