import{i as c,j as e,S as a,b as n,T as t,K as l,B as d}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const g={title:"Layout/Section",component:c,argTypes:{title:{control:"text"},subtitle:{control:"text"},children:{control:"text"}}},r={args:{title:"Recent activity",subtitle:"Last 24 hours",children:"Section content goes here."}},i={parameters:{controls:{disable:!0}},render:()=>e.jsx(c,{title:"Recent activity",subtitle:"Last 24 hours",children:e.jsxs(a,{direction:"vertical",gap:"sm",children:[e.jsxs(a,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(n,{variant:"success",children:"Deployed"}),e.jsx(t,{variant:"body",children:"v2.4.1 pushed to production"}),e.jsx(t,{variant:"caption",color:"muted",children:"2 hours ago"})]}),e.jsxs(a,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(n,{variant:"warning",children:"Pending"}),e.jsx(t,{variant:"body",children:"Database migration queued"}),e.jsx(t,{variant:"caption",color:"muted",children:"5 hours ago"})]}),e.jsxs(a,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(n,{variant:"info",children:"Review"}),e.jsx(t,{variant:"body",children:"Auth refactor ready for review"}),e.jsx(t,{variant:"caption",color:"muted",children:"8 hours ago"})]})]})})},o={parameters:{controls:{disable:!0}},render:()=>e.jsx(c,{title:"Team members",subtitle:"3 active",actions:e.jsxs(a,{direction:"horizontal",gap:"sm",children:[e.jsx(d,{variant:"ghost",size:"sm",children:"Manage"}),e.jsx(d,{size:"sm",children:"Invite"})]}),children:e.jsxs(a,{direction:"vertical",gap:"sm",children:[e.jsx(l,{label:"Alice Chen",children:"Owner"}),e.jsx(l,{label:"Bob Park",children:"Admin"}),e.jsx(l,{label:"Carol Liu",children:"Member"})]})})},s={parameters:{controls:{disable:!0}},render:()=>e.jsx(c,{title:"Build queue",footer:e.jsx(t,{variant:"caption",color:"muted",children:"Showing 2 of 14 builds"}),children:e.jsxs(a,{direction:"vertical",gap:"sm",children:[e.jsxs(a,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(n,{variant:"success",dot:!0,pulse:!0}),e.jsx(t,{variant:"body",children:"main — build #482"})]}),e.jsxs(a,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(n,{variant:"default",dot:!0}),e.jsx(t,{variant:"body",children:"feature/auth — build #481"})]})]})})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Recent activity",
    subtitle: "Last 24 hours",
    children: "Section content goes here."
  }
}`,...r.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Section title="Recent activity" subtitle="Last 24 hours">
      <Stack direction="vertical" gap="sm">
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="success">Deployed</Badge>
          <Text variant="body">v2.4.1 pushed to production</Text>
          <Text variant="caption" color="muted">2 hours ago</Text>
        </Stack>
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="warning">Pending</Badge>
          <Text variant="body">Database migration queued</Text>
          <Text variant="caption" color="muted">5 hours ago</Text>
        </Stack>
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="info">Review</Badge>
          <Text variant="body">Auth refactor ready for review</Text>
          <Text variant="caption" color="muted">8 hours ago</Text>
        </Stack>
      </Stack>
    </Section>
}`,...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Section title="Team members" subtitle="3 active" actions={<Stack direction="horizontal" gap="sm">
          <Button variant="ghost" size="sm">Manage</Button>
          <Button size="sm">Invite</Button>
        </Stack>}>
      <Stack direction="vertical" gap="sm">
        <KeyValue label="Alice Chen">Owner</KeyValue>
        <KeyValue label="Bob Park">Admin</KeyValue>
        <KeyValue label="Carol Liu">Member</KeyValue>
      </Stack>
    </Section>
}`,...o.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Section title="Build queue" footer={<Text variant="caption" color="muted">Showing 2 of 14 builds</Text>}>
      <Stack direction="vertical" gap="sm">
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="success" dot pulse />
          <Text variant="body">main — build #482</Text>
        </Stack>
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="default" dot />
          <Text variant="body">feature/auth — build #481</Text>
        </Stack>
      </Stack>
    </Section>
}`,...s.parameters?.docs?.source}}};const p=["Default","ActivityFeed","WithActions","WithFooter"];export{i as ActivityFeed,r as Default,o as WithActions,s as WithFooter,p as __namedExportsOrder,g as default};
