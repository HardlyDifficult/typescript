import{C as o,j as e,T as r,b as i}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Layout/Card",component:o,argTypes:{title:{control:"text"},interactive:{control:"boolean"},children:{control:"text"}}},t={args:{children:"Card content goes here."}},n={parameters:{controls:{disable:!0}},render:()=>e.jsxs(o,{children:[e.jsx(r,{variant:"subheading",children:"PR #142"}),e.jsx(r,{variant:"body",children:"Add retry logic to webhook delivery"}),e.jsx(r,{variant:"caption",children:"Opened 3 hours ago"})]})},a={parameters:{controls:{disable:!0}},render:()=>e.jsx(o,{title:"Team Members",children:e.jsx(r,{variant:"body",children:"Three engineers, one designer, and a product lead."})})},s={parameters:{controls:{disable:!0}},render:()=>e.jsx(o,{title:"Deployment Status",footer:e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"},children:[e.jsx(r,{variant:"caption",children:"Last deployed 2 minutes ago"}),e.jsx(i,{variant:"success",children:"Live"})]}),children:e.jsx(r,{variant:"body",children:"v2.4.1 is running on 4 instances across us-east-1."})})};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    children: "Card content goes here."
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Card>
      <Text variant="subheading">PR #142</Text>
      <Text variant="body">Add retry logic to webhook delivery</Text>
      <Text variant="caption">Opened 3 hours ago</Text>
    </Card>
}`,...n.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Card title="Team Members">
      <Text variant="body">Three engineers, one designer, and a product lead.</Text>
    </Card>
}`,...a.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Card title="Deployment Status" footer={<div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}>
          <Text variant="caption">Last deployed 2 minutes ago</Text>
          <Badge variant="success">Live</Badge>
        </div>}>
      <Text variant="body">v2.4.1 is running on 4 instances across us-east-1.</Text>
    </Card>
}`,...s.parameters?.docs?.source}}};const u=["Default","PullRequest","WithTitle","WithTitleAndFooter"];export{t as Default,n as PullRequest,a as WithTitle,s as WithTitleAndFooter,u as __namedExportsOrder,p as default};
