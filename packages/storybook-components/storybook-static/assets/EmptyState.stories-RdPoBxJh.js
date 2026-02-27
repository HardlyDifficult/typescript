import{E as s,j as r}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const c={title:"Feedback/EmptyState",component:s,argTypes:{title:{control:"text"},children:{control:"text"}}},e={args:{title:"No sessions found",children:"Start a new session to see activity here."}},t={parameters:{controls:{disable:!0}},render:()=>r.jsx(s,{icon:"📭",title:"No messages",children:"You're all caught up. New messages will appear here."})};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    title: "No sessions found",
    children: "Start a new session to see activity here."
  }
}`,...e.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <EmptyState icon="📭" title="No messages">
      You're all caught up. New messages will appear here.
    </EmptyState>
}`,...t.parameters?.docs?.source}}};const i=["Default","WithIcon"];export{e as Default,t as WithIcon,i as __namedExportsOrder,c as default};
