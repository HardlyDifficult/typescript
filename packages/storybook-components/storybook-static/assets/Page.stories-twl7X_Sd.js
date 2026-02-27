import{P as o,j as e,C as l,S as a,T as t,B as c,h as d,i as h,b as g}from"./Collapsible-DxrLOWAC.js";import"./iframe-Ba19r_gW.js";import"./preload-helper-PPVm8Dsz.js";const x={title:"Layout/Page",component:o,parameters:{layout:"fullscreen"},argTypes:{maxWidth:{control:"select",options:["sm","md","lg","full"]}}},n={args:{maxWidth:"lg",children:"Page content"}},r={parameters:{controls:{disable:!0}},render:()=>e.jsx(o,{children:e.jsxs(a,{direction:"vertical",gap:"md",children:[e.jsx(t,{variant:"caption",color:"muted",children:"Page provides the outer shell: a max-width container, consistent padding, and a title bar. Everything inside is your content."}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"var(--space-4)"},children:[e.jsx(d,{label:"Open PRs",value:"12"}),e.jsx(d,{label:"Merged today",value:"5",trend:"up"}),e.jsx(d,{label:"Failed checks",value:"2",trend:"down"})]}),e.jsx(h,{title:"Recent activity",children:e.jsx(l,{children:e.jsxs(a,{direction:"vertical",gap:"sm",children:[e.jsxs(a,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(g,{variant:"success",children:"Merged"}),e.jsx(t,{variant:"body",children:"feat: add webhook retry logic"})]}),e.jsxs(a,{direction:"horizontal",gap:"sm",align:"center",children:[e.jsx(g,{variant:"warning",children:"Review"}),e.jsx(t,{variant:"body",children:"fix: rate limiter edge case"})]})]})})})]})})},i={parameters:{controls:{disable:!0}},render:()=>e.jsx(o,{headerActions:e.jsxs(a,{direction:"horizontal",gap:"sm",children:[e.jsx(c,{variant:"secondary",size:"sm",children:"Cancel"}),e.jsx(c,{size:"sm",children:"Save changes"})]}),children:e.jsx(h,{title:"General",children:e.jsx(l,{children:e.jsx(t,{variant:"body",children:"headerActions places buttons in the top-right corner, aligned with the page title."})})})})},s={parameters:{controls:{disable:!0}},render:()=>e.jsx(o,{maxWidth:"sm",children:e.jsx(l,{children:e.jsxs(a,{direction:"vertical",gap:"sm",children:[e.jsx(t,{variant:"body",children:'maxWidth="sm" constrains the page to 640px, good for focused forms.'}),e.jsx(c,{fullWidth:!0,children:"Sign in with Google"})]})})})};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    maxWidth: "lg",
    children: "Page content"
  }
}`,...n.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Page>
      <Stack direction="vertical" gap="md">
        <Text variant="caption" color="muted">
          Page provides the outer shell: a max-width container, consistent padding, and a title bar.
          Everything inside is your content.
        </Text>
        <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--space-4)"
      }}>
          <StatCard label="Open PRs" value="12" />
          <StatCard label="Merged today" value="5" trend="up" />
          <StatCard label="Failed checks" value="2" trend="down" />
        </div>
        <Section title="Recent activity">
          <Card>
            <Stack direction="vertical" gap="sm">
              <Stack direction="horizontal" gap="sm" align="center">
                <Badge variant="success">Merged</Badge>
                <Text variant="body">feat: add webhook retry logic</Text>
              </Stack>
              <Stack direction="horizontal" gap="sm" align="center">
                <Badge variant="warning">Review</Badge>
                <Text variant="body">fix: rate limiter edge case</Text>
              </Stack>
            </Stack>
          </Card>
        </Section>
      </Stack>
    </Page>
}`,...r.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Page headerActions={<Stack direction="horizontal" gap="sm">
        <Button variant="secondary" size="sm">Cancel</Button>
        <Button size="sm">Save changes</Button>
      </Stack>}>
      <Section title="General">
        <Card>
          <Text variant="body">headerActions places buttons in the top-right corner, aligned with the page title.</Text>
        </Card>
      </Section>
    </Page>
}`,...i.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <Page maxWidth="sm">
      <Card>
        <Stack direction="vertical" gap="sm">
          <Text variant="body">maxWidth=&quot;sm&quot; constrains the page to 640px, good for focused forms.</Text>
          <Button fullWidth>Sign in with Google</Button>
        </Stack>
      </Card>
    </Page>
}`,...s.parameters?.docs?.source}}};const v=["Default","Overview","WithHeaderActions","NarrowWidth"];export{n as Default,s as NarrowWidth,r as Overview,i as WithHeaderActions,v as __namedExportsOrder,x as default};
