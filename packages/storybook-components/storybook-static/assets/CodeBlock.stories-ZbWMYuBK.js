import"./iframe-Ba19r_gW.js";import{f as o}from"./Collapsible-DxrLOWAC.js";import"./preload-helper-PPVm8Dsz.js";const c={title:"Content/CodeBlock",component:o,argTypes:{variant:{control:"select",options:["default","error"]},language:{control:"text"},wrap:{control:"boolean"},children:{control:"text"}}},e={args:{variant:"default",language:"typescript",wrap:!1,children:"function greet(name: string): string {\n  return `Hello, ${name}!`;\n}"}},n={parameters:{controls:{disable:!0}},args:{language:"typescript",children:`import { Stack, Text } from "@hardlydifficult/storybook-components";

interface AppProps {
  title: string;
  count: number;
  enabled: boolean;
}

// Main component
function App({ title, count, enabled }: AppProps) {
  const message = \`Hello \${title}\`;
  const items = [1, 2, 3];

  if (!enabled) {
    return null;
  }

  /* Render the content */
  return (
    <Stack gap="md">
      <Text variant="heading">{message}</Text>
      <Text variant="caption">{count} items</Text>
    </Stack>
  );
}

export default App;`}},r={parameters:{controls:{disable:!0}},args:{children:`This is plain text without any syntax highlighting.
It still has line numbers and the copy button.
No language prop is set.`}},t={parameters:{controls:{disable:!0}},args:{variant:"error",language:"typescript",children:`TypeError: Cannot read properties of undefined (reading 'map')
    at App (App.tsx:12:18)
    at renderWithHooks (react-dom.development.js:14985:18)`}},a={parameters:{controls:{disable:!0}},args:{language:"json",wrap:!0,children:'{"name":"@hardlydifficult/storybook-components","version":"0.0.1","description":"A long description that might wrap around when the container is narrow enough to cause wrapping behavior in the code block"}'}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "default",
    language: "typescript",
    wrap: false,
    children: \`function greet(name: string): string {\\n  return \\\`Hello, \\\${name}!\\\`;\\n}\`
  }
}`,...e.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    language: "typescript",
    children: \`import { Stack, Text } from "@hardlydifficult/storybook-components";

interface AppProps {
  title: string;
  count: number;
  enabled: boolean;
}

// Main component
function App({ title, count, enabled }: AppProps) {
  const message = \\\`Hello \\\${title}\\\`;
  const items = [1, 2, 3];

  if (!enabled) {
    return null;
  }

  /* Render the content */
  return (
    <Stack gap="md">
      <Text variant="heading">{message}</Text>
      <Text variant="caption">{count} items</Text>
    </Stack>
  );
}

export default App;\`
  }
}`,...n.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    children: \`This is plain text without any syntax highlighting.
It still has line numbers and the copy button.
No language prop is set.\`
  }
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    variant: "error",
    language: "typescript",
    children: \`TypeError: Cannot read properties of undefined (reading 'map')
    at App (App.tsx:12:18)
    at renderWithHooks (react-dom.development.js:14985:18)\`
  }
}`,...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    controls: {
      disable: true
    }
  },
  args: {
    language: "json",
    wrap: true,
    children: \`{"name":"@hardlydifficult/storybook-components","version":"0.0.1","description":"A long description that might wrap around when the container is narrow enough to cause wrapping behavior in the code block"}\`
  }
}`,...a.parameters?.docs?.source}}};const l=["Default","TypeScript","PlainText","ErrorVariant","WithWrap"];export{e as Default,t as ErrorVariant,r as PlainText,n as TypeScript,a as WithWrap,l as __namedExportsOrder,c as default};
