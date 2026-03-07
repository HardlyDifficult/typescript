import{A as a,j as t,B as u}from"./Collapsible-BqOtdgWS.js";import"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const w={title:"Data/ActivityItem",component:a,argTypes:{summary:{control:"text"},timestamp:{control:"text"},badge:{control:"text"},variant:{control:"select",options:["default","success","warning","error","info"]}}},e=new Date("2025-01-01T12:00:00.000Z"),n={args:{summary:"Worker started processing request",timestamp:new Date(e.getTime()-30*1e3).toISOString(),now:e}},r={args:{summary:"Claude API call completed",timestamp:new Date(e.getTime()-120*1e3).toISOString(),badge:"claude_api",variant:"info",now:e}},s={args:{summary:"PR #42 merged successfully",timestamp:new Date(e.getTime()-300*1e3).toISOString(),badge:"github",variant:"success",now:e}},i={args:{summary:"CI pipeline failed: 3 tests failing",timestamp:new Date(e.getTime()-600*1e3).toISOString(),badge:"action",variant:"error",now:e}},o={args:{summary:"Rate limit approaching: 80% used",timestamp:new Date(e.getTime()-900*1e3).toISOString(),variant:"warning",now:e}},m={args:{summary:"Running: fix-ci-pipeline",timestamp:new Date(e.getTime()-60*1e3).toISOString(),badge:"worker",variant:"info",now:e,actions:t.jsx(u,{variant:"ghost",size:"sm",onClick:()=>{console.log("cancel")},children:"Cancel"})}},c={args:{summary:"Claude response received (1,247 tokens)",timestamp:new Date(e.getTime()-180*1e3).toISOString(),badge:"claude_api",variant:"info",now:e,children:t.jsx("pre",{style:{fontSize:"0.75rem",background:"var(--color-bg-muted)",padding:"var(--space-2)",borderRadius:"var(--radius-sm)",overflow:"auto",margin:0},children:JSON.stringify({model:"claude-sonnet-4-20250514",inputTokens:523,outputTokens:724,duration:"2.3s",prompt:"Analyze the failing CI tests and suggest fixes..."},null,2)})}},d={args:{icon:t.jsx("svg",{width:"14",height:"14",viewBox:"0 0 16 16",fill:"currentColor",children:t.jsx("path",{d:"M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"})}),summary:"Push received: feature/add-chat-interface (3 commits)",timestamp:new Date(e.getTime()-1200*1e3).toISOString(),badge:"github",variant:"default",now:e}},g={parameters:{controls:{disable:!0}},render:()=>t.jsxs("div",{style:{maxWidth:700,border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",overflow:"hidden"},children:[t.jsx(a,{summary:"User sent message: check PR status",timestamp:new Date(e.getTime()-600*1e3).toISOString(),badge:"chat",variant:"info",now:e}),t.jsx(a,{summary:"Fetching open PRs from GitHub...",timestamp:new Date(e.getTime()-540*1e3).toISOString(),badge:"github",now:e}),t.jsx(a,{summary:"Found 3 open PRs",timestamp:new Date(e.getTime()-540*1e3).toISOString(),badge:"github",variant:"success",now:e,children:t.jsxs("div",{style:{fontSize:"0.75rem",color:"var(--color-text-secondary)",display:"flex",flexDirection:"column",gap:"0.25rem"},children:[t.jsx("div",{children:"#42 fix-auth-flow — ready for review"}),t.jsx("div",{children:"#43 update-deps — CI failing"}),t.jsx("div",{children:"#44 add-dashboard-chat — draft"})]})}),t.jsx(a,{summary:"CI pipeline failed on #43",timestamp:new Date(e.getTime()-480*1e3).toISOString(),badge:"action",variant:"error",now:e}),t.jsx(a,{summary:"Response sent to dashboard",timestamp:new Date(e.getTime()-480*1e3).toISOString(),badge:"chat",variant:"success",now:e})]})};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    summary: "Worker started processing request",
    timestamp: new Date(NOW.getTime() - 30 * 1000).toISOString(),
    now: NOW
  }
}`,...n.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    summary: "Claude API call completed",
    timestamp: new Date(NOW.getTime() - 2 * 60 * 1000).toISOString(),
    badge: "claude_api",
    variant: "info",
    now: NOW
  }
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    summary: "PR #42 merged successfully",
    timestamp: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
    badge: "github",
    variant: "success",
    now: NOW
  }
}`,...s.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    summary: "CI pipeline failed: 3 tests failing",
    timestamp: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
    badge: "action",
    variant: "error",
    now: NOW
  }
}`,...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    summary: "Rate limit approaching: 80% used",
    timestamp: new Date(NOW.getTime() - 15 * 60 * 1000).toISOString(),
    variant: "warning",
    now: NOW
  }
}`,...o.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    summary: "Running: fix-ci-pipeline",
    timestamp: new Date(NOW.getTime() - 60 * 1000).toISOString(),
    badge: "worker",
    variant: "info",
    now: NOW,
    actions: <Button variant="ghost" size="sm" onClick={() => {
      console.log("cancel");
    }}>
        Cancel
      </Button>
  }
}`,...m.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    summary: "Claude response received (1,247 tokens)",
    timestamp: new Date(NOW.getTime() - 3 * 60 * 1000).toISOString(),
    badge: "claude_api",
    variant: "info",
    now: NOW,
    children: <pre style={{
      fontSize: "0.75rem",
      background: "var(--color-bg-muted)",
      padding: "var(--space-2)",
      borderRadius: "var(--radius-sm)",
      overflow: "auto",
      margin: 0
    }}>
        {JSON.stringify({
        model: "claude-sonnet-4-20250514",
        inputTokens: 523,
        outputTokens: 724,
        duration: "2.3s",
        prompt: "Analyze the failing CI tests and suggest fixes..."
      }, null, 2)}
      </pre>
  }
}`,...c.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>,
    summary: "Push received: feature/add-chat-interface (3 commits)",
    timestamp: new Date(NOW.getTime() - 20 * 60 * 1000).toISOString(),
    badge: "github",
    variant: "default",
    now: NOW
  }
}`,...d.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <div style={{
    maxWidth: 700,
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden"
  }}>
      <ActivityItem summary="User sent message: check PR status" timestamp={new Date(NOW.getTime() - 10 * 60 * 1000).toISOString()} badge="chat" variant="info" now={NOW} />
      <ActivityItem summary="Fetching open PRs from GitHub..." timestamp={new Date(NOW.getTime() - 9 * 60 * 1000).toISOString()} badge="github" now={NOW} />
      <ActivityItem summary="Found 3 open PRs" timestamp={new Date(NOW.getTime() - 9 * 60 * 1000).toISOString()} badge="github" variant="success" now={NOW}>
        <div style={{
        fontSize: "0.75rem",
        color: "var(--color-text-secondary)",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem"
      }}>
          <div>#42 fix-auth-flow — ready for review</div>
          <div>#43 update-deps — CI failing</div>
          <div>#44 add-dashboard-chat — draft</div>
        </div>
      </ActivityItem>
      <ActivityItem summary="CI pipeline failed on #43" timestamp={new Date(NOW.getTime() - 8 * 60 * 1000).toISOString()} badge="action" variant="error" now={NOW} />
      <ActivityItem summary="Response sent to dashboard" timestamp={new Date(NOW.getTime() - 8 * 60 * 1000).toISOString()} badge="chat" variant="success" now={NOW} />
    </div>
}`,...g.parameters?.docs?.source}}};const S=["Default","WithBadge","Success","Error","Warning","WithActions","Expandable","WithIcon","Timeline"];export{n as Default,i as Error,c as Expandable,s as Success,g as Timeline,o as Warning,m as WithActions,r as WithBadge,d as WithIcon,S as __namedExportsOrder,w as default};
