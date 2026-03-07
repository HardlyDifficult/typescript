import{e as n,j as t}from"./Collapsible-BqOtdgWS.js";import"./iframe-Brhnuqv1.js";import"./preload-helper-PPVm8Dsz.js";const g={title:"Content/ChatMessage",component:n,argTypes:{variant:{control:"select",options:["user","bot"]},content:{control:"text"},timestamp:{control:"text"}}},e=new Date("2025-01-01T12:00:00.000Z"),a={args:{content:"Can you check why CI is failing on the main branch?",timestamp:new Date(e.getTime()-120*1e3).toISOString(),variant:"user",now:e}},r={parameters:{controls:{disable:!0}},render:()=>t.jsx(n,{content:"I found 3 failing tests in the auth module. The issue is a missing environment variable `AUTH_SECRET` in the CI config. I'll create a fix.",timestamp:new Date(e.getTime()-60*1e3).toISOString(),variant:"bot",now:e})},s={parameters:{controls:{disable:!0}},render:()=>t.jsx(n,{content:"Here's what I found:\n\n1. Test `auth.login` fails due to missing env var\n2. Test `auth.signup` times out\n3. Test `auth.reset` has a type error",timestamp:new Date(e.getTime()-300*1e3).toISOString(),variant:"bot",now:e})},o={parameters:{controls:{disable:!0}},render:()=>t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"var(--space-2)",maxWidth:600},children:[t.jsx(n,{content:"What PRs are open right now?",timestamp:new Date(e.getTime()-600*1e3).toISOString(),variant:"user",now:e}),t.jsx(n,{content:`There are 3 open PRs:
- #42 fix-auth-flow (ready for review)
- #43 update-deps (CI failing)
- #44 add-dashboard-chat (draft)`,timestamp:new Date(e.getTime()-540*1e3).toISOString(),variant:"bot",now:e}),t.jsx(n,{content:"Can you review #42?",timestamp:new Date(e.getTime()-480*1e3).toISOString(),variant:"user",now:e}),t.jsx(n,{content:"Starting code review for #42 fix-auth-flow...",timestamp:new Date(e.getTime()-420*1e3).toISOString(),variant:"bot",now:e})]})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    content: "Can you check why CI is failing on the main branch?",
    timestamp: new Date(NOW.getTime() - 2 * 60 * 1000).toISOString(),
    variant: "user",
    now: NOW
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <ChatMessage content="I found 3 failing tests in the auth module. The issue is a missing environment variable \`AUTH_SECRET\` in the CI config. I'll create a fix." timestamp={new Date(NOW.getTime() - 60 * 1000).toISOString()} variant="bot" now={NOW} />
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <ChatMessage content={"Here's what I found:\\n\\n1. Test \`auth.login\` fails due to missing env var\\n2. Test \`auth.signup\` times out\\n3. Test \`auth.reset\` has a type error"} timestamp={new Date(NOW.getTime() - 5 * 60 * 1000).toISOString()} variant="bot" now={NOW} />
}`,...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    maxWidth: 600
  }}>
      <ChatMessage content="What PRs are open right now?" timestamp={new Date(NOW.getTime() - 10 * 60 * 1000).toISOString()} variant="user" now={NOW} />
      <ChatMessage content={"There are 3 open PRs:\\n- #42 fix-auth-flow (ready for review)\\n- #43 update-deps (CI failing)\\n- #44 add-dashboard-chat (draft)"} timestamp={new Date(NOW.getTime() - 9 * 60 * 1000).toISOString()} variant="bot" now={NOW} />
      <ChatMessage content="Can you review #42?" timestamp={new Date(NOW.getTime() - 8 * 60 * 1000).toISOString()} variant="user" now={NOW} />
      <ChatMessage content="Starting code review for #42 fix-auth-flow..." timestamp={new Date(NOW.getTime() - 7 * 60 * 1000).toISOString()} variant="bot" now={NOW} />
    </div>
}`,...o.parameters?.docs?.source}}};const u=["Default","BotMessage","MultilineMessage","Conversation"];export{r as BotMessage,o as Conversation,a as Default,s as MultilineMessage,u as __namedExportsOrder,g as default};
