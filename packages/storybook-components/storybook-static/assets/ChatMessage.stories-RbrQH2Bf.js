import{d as t,j as e}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Content/ChatMessage",component:t,argTypes:{variant:{control:"select",options:["user","bot"]},content:{control:"text"},timestamp:{control:"text"}}},a={args:{content:"Can you check why CI is failing on the main branch?",timestamp:new Date(Date.now()-120*1e3).toISOString(),variant:"user"}},n={parameters:{controls:{disable:!0}},render:()=>e.jsx(t,{content:"I found 3 failing tests in the auth module. The issue is a missing environment variable `AUTH_SECRET` in the CI config. I'll create a fix.",timestamp:new Date(Date.now()-60*1e3).toISOString(),variant:"bot"})},r={parameters:{controls:{disable:!0}},render:()=>e.jsx(t,{content:"Here's what I found:\n\n1. Test `auth.login` fails due to missing env var\n2. Test `auth.signup` times out\n3. Test `auth.reset` has a type error",timestamp:new Date(Date.now()-300*1e3).toISOString(),variant:"bot"})},s={parameters:{controls:{disable:!0}},render:()=>e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"var(--space-2)",maxWidth:600},children:[e.jsx(t,{content:"What PRs are open right now?",timestamp:new Date(Date.now()-600*1e3).toISOString(),variant:"user"}),e.jsx(t,{content:`There are 3 open PRs:
- #42 fix-auth-flow (ready for review)
- #43 update-deps (CI failing)
- #44 add-dashboard-chat (draft)`,timestamp:new Date(Date.now()-540*1e3).toISOString(),variant:"bot"}),e.jsx(t,{content:"Can you review #42?",timestamp:new Date(Date.now()-480*1e3).toISOString(),variant:"user"}),e.jsx(t,{content:"Starting code review for #42 fix-auth-flow...",timestamp:new Date(Date.now()-420*1e3).toISOString(),variant:"bot"})]})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    content: "Can you check why CI is failing on the main branch?",
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    variant: "user"
  }
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <ChatMessage content="I found 3 failing tests in the auth module. The issue is a missing environment variable \`AUTH_SECRET\` in the CI config. I'll create a fix." timestamp={new Date(Date.now() - 60 * 1000).toISOString()} variant="bot" />
}`,...n.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <ChatMessage content={"Here's what I found:\\n\\n1. Test \`auth.login\` fails due to missing env var\\n2. Test \`auth.signup\` times out\\n3. Test \`auth.reset\` has a type error"} timestamp={new Date(Date.now() - 5 * 60 * 1000).toISOString()} variant="bot" />
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
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
      <ChatMessage content="What PRs are open right now?" timestamp={new Date(Date.now() - 10 * 60 * 1000).toISOString()} variant="user" />
      <ChatMessage content={"There are 3 open PRs:\\n- #42 fix-auth-flow (ready for review)\\n- #43 update-deps (CI failing)\\n- #44 add-dashboard-chat (draft)"} timestamp={new Date(Date.now() - 9 * 60 * 1000).toISOString()} variant="bot" />
      <ChatMessage content="Can you review #42?" timestamp={new Date(Date.now() - 8 * 60 * 1000).toISOString()} variant="user" />
      <ChatMessage content="Starting code review for #42 fix-auth-flow..." timestamp={new Date(Date.now() - 7 * 60 * 1000).toISOString()} variant="bot" />
    </div>
}`,...s.parameters?.docs?.source}}};const u=["Default","BotMessage","MultilineMessage","Conversation"];export{n as BotMessage,s as Conversation,a as Default,r as MultilineMessage,u as __namedExportsOrder,m as default};
