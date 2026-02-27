import"./iframe-Ba19r_gW.js";import{m as n}from"./Collapsible-DxrLOWAC.js";import"./preload-helper-PPVm8Dsz.js";const a={title:"Content/TextViewer",component:n,argTypes:{content:{control:"text"},json:{control:"object"},defaultMode:{control:"select",options:["text","markdown","json"]},onChange:{control:!1},autoScroll:{control:!1}}},e={args:{content:`# Hello world

This is a **markdown** document with _italic_ text and \`inline code\`.

## Features

- Multi-mode viewing
- Syntax highlighted code blocks
- JSON tree explorer

\`\`\`typescript
const greeting = (name: string) => \`Hello, \${name}!\`;
\`\`\`
`,defaultMode:"markdown"}},t={args:{json:{id:"evt_123",type:"workflow.completed",status:"success",duration:4200,steps:["plan","execute","review"]},defaultMode:"json"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    content: \`# Hello world

This is a **markdown** document with _italic_ text and \\\`inline code\\\`.

## Features

- Multi-mode viewing
- Syntax highlighted code blocks
- JSON tree explorer

\\\`\\\`\\\`typescript
const greeting = (name: string) => \\\`Hello, \\\${name}!\\\`;
\\\`\\\`\\\`
\`,
    defaultMode: "markdown"
  }
}`,...e.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    json: {
      id: "evt_123",
      type: "workflow.completed",
      status: "success",
      duration: 4200,
      steps: ["plan", "execute", "review"]
    },
    defaultMode: "json"
  }
}`,...t.parameters?.docs?.source}}};const c=["Markdown","Json"];export{t as Json,e as Markdown,c as __namedExportsOrder,a as default};
