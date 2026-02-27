import{g as a,j as e,T as l,B as o}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const c={title:"Navigation/Collapsible",component:a,argTypes:{title:{control:"text"},defaultOpen:{control:"boolean"}}},t={args:{title:"Advanced Settings",defaultOpen:!1},render:s=>e.jsx(a,{title:s.title,defaultOpen:s.defaultOpen,children:e.jsx(l,{children:"Hidden content is revealed when expanded."})},String(s.defaultOpen))},n={parameters:{controls:{disable:!0}},render:()=>e.jsx(a,{title:"Build Details",defaultOpen:!0,children:e.jsx(l,{children:"This section starts open."})})},r={parameters:{controls:{disable:!0}},render:()=>e.jsx(a,{title:"Deployment Log",actions:e.jsx(o,{variant:"ghost",size:"sm",children:"Clear"}),children:e.jsx(l,{children:"Log entries would appear here."})})};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Advanced Settings",
    defaultOpen: false
  },
  render: args =>
  // key forces remount when defaultOpen changes so the internal state resets
  <Collapsible key={String(args.defaultOpen)} title={args.title} defaultOpen={args.defaultOpen}>
      <Text>Hidden content is revealed when expanded.</Text>
    </Collapsible>
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Collapsible title="Build Details" defaultOpen>
      <Text>This section starts open.</Text>
    </Collapsible>
}`,...n.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Collapsible title="Deployment Log" actions={<Button variant="ghost" size="sm">Clear</Button>}>
      <Text>Log entries would appear here.</Text>
    </Collapsible>
}`,...r.parameters?.docs?.source}}};const u=["Default","DefaultOpen","WithActions"];export{t as Default,n as DefaultOpen,r as WithActions,u as __namedExportsOrder,c as default};
