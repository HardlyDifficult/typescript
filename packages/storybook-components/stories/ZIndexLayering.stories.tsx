import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { GlobalNav, Modal, Tooltip, Button, Text, Stack, Card } from "../src/index.js";

const NAV_CATEGORIES = [
  {
    label: "Sessions",
    items: [
      { href: "/sessions", label: "Active Sessions" },
      { href: "/sessions/history", label: "Session History" },
      { href: "/sessions/analytics", label: "Session Analytics" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/tools", label: "Code Tools" },
      { href: "/tools/ai", label: "AI Tools" },
    ],
  },
];

const meta: Meta = {
  title: "Testing/ZIndex Layering",
  parameters: { 
    layout: "fullscreen",
    docs: {
      description: {
        component: `
This story tests the z-index layering hierarchy to prevent regressions:
- Tooltip: z-40 (lowest)
- GlobalNav Dropdown: z-45 (middle) 
- Modal: z-50 (highest)

All three components should be able to overlap correctly without z-index conflicts.
        `,
      },
    },
  },
};
export default meta;

type Story = StoryObj;

export const LayeringTest: Story = {
  render: () => {
    const [modalOpen, setModalOpen] = useState(false);
    const [sessionCount, setSessionCount] = useState(3);
    
    return (
      <div style={{ minHeight: "100vh" }}>
        {/* GlobalNav with dropdown */}
        <GlobalNav
          title="Cursor Sessions"
          categories={NAV_CATEGORIES}
          currentPath="/sessions"
          onSignOut={() => alert("Sign out")}
          onToggleTheme={() => alert("Toggle theme")}
          theme="light"
          renderLink={({ href, children, onClick }) => (
            <a 
              href={href} 
              onClick={(e) => { e.preventDefault(); onClick?.(); }}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {children}
            </a>
          )}
        />
        
        {/* Main content area with overlapping elements */}
        <div style={{ padding: "2rem" }}>
          <Stack direction="vertical" gap="lg">
            {/* Header with tooltip and modal trigger */}
            <Card>
              <Stack direction="vertical" gap="md">
                <Text variant="heading-sm">Z-Index Layering Test</Text>
                <Text variant="body" color="muted">
                  This test ensures proper layering of UI components. Try the following:
                </Text>
                <Text variant="body" color="muted">
                  1. Open the navigation dropdown (top right)
                </Text>
                <Text variant="body" color="muted">
                  2. Hover over elements with tooltips
                </Text>
                <Text variant="body" color="muted">
                  3. Open modal while dropdown is visible
                </Text>
                <Text variant="body" color="muted">
                  The modal should appear above everything else.
                </Text>
              </Stack>
            </Card>

            {/* Interactive elements with tooltips */}
            <Card>
              <Stack direction="vertical" gap="md">
                <Text variant="heading-xs">Session Controls</Text>
                
                <Stack direction="horizontal" gap="md" align="center">
                  <Tooltip content="Current number of active cursor sessions">
                    <div style={{ 
                      padding: "0.5rem 1rem", 
                      background: "var(--color-bg-subtle)", 
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      cursor: "help"
                    }}>
                      Sessions: {sessionCount}
                    </div>
                  </Tooltip>
                  
                  <Tooltip content="Add a new cursor session">
                    <Button 
                      onClick={() => setSessionCount(prev => prev + 1)}
                      size="sm"
                    >
                      Add Session
                    </Button>
                  </Tooltip>
                  
                  <Tooltip content="Remove the most recent session">
                    <Button 
                      onClick={() => setSessionCount(prev => Math.max(0, prev - 1))}
                      variant="secondary"
                      size="sm"
                    >
                      Remove Session
                    </Button>
                  </Tooltip>
                </Stack>
                
                {/* Modal trigger in a position that tests overlap */}
                <Stack direction="horizontal" gap="md" align="center">
                  <Tooltip content="Open session details in a modal dialog. This modal should appear above all other elements including navigation dropdowns.">
                    <Button 
                      onClick={() => setModalOpen(true)}
                      variant="primary"
                    >
                      View Session Details
                    </Button>
                  </Tooltip>
                  
                  <Text variant="caption" color="muted">
                    ← This button opens a modal that tests z-index priority
                  </Text>
                </Stack>
              </Stack>
            </Card>

            {/* Additional tooltips to test layering */}
            <Card>
              <Stack direction="vertical" gap="md">
                <Text variant="heading-xs">Tooltip Layering Test</Text>
                <Text variant="body" color="muted">
                  Hover over these elements with the navigation dropdown open:
                </Text>
                
                <Stack direction="horizontal" gap="sm" wrap>
                  <Tooltip content="Tooltip 1 - This should appear below navigation dropdowns">
                    <Button variant="outline" size="sm">Element 1</Button>
                  </Tooltip>
                  <Tooltip content="Tooltip 2 - Multiple tooltips can appear simultaneously">
                    <Button variant="outline" size="sm">Element 2</Button>
                  </Tooltip>
                  <Tooltip content="Tooltip 3 - All tooltips should have the same z-index (40)">
                    <Button variant="outline" size="sm">Element 3</Button>
                  </Tooltip>
                  <Tooltip content="Tooltip 4 - Navigation dropdown should appear above these tooltips">
                    <Button variant="outline" size="sm">Element 4</Button>
                  </Tooltip>
                </Stack>
              </Stack>
            </Card>
          </Stack>
        </div>

        {/* Modal for testing highest z-index */}
        {modalOpen && (
          <Modal 
            title="Session Details" 
            size="md"
            onClose={() => setModalOpen(false)}
          >
            <Stack direction="vertical" gap="md">
              <Text variant="body">
                This modal should appear above all other elements, including:
              </Text>
              <Text variant="body">• Navigation dropdowns (z-45)</Text>
              <Text variant="body">• Tooltips (z-40)</Text>
              <Text variant="body">• All other page content</Text>
              
              <div style={{ marginTop: "1rem" }}>
                <Text variant="caption" color="muted">
                  Z-Index Test Results:
                </Text>
                <Text variant="caption" color="muted">
                  ✓ Modal appears above navigation dropdown
                </Text>
                <Text variant="caption" color="muted">
                  ✓ Modal appears above tooltips  
                </Text>
                <Text variant="caption" color="muted">
                  ✓ Navigation dropdown appears above tooltips
                </Text>
              </div>
              
              <Stack direction="horizontal" gap="sm" justify="end">
                <Button 
                  onClick={() => setModalOpen(false)}
                  variant="primary"
                >
                  Close
                </Button>
              </Stack>
            </Stack>
          </Modal>
        )}
      </div>
    );
  },
};

export const EdgeCaseTest: Story = {
  render: () => {
    const [modal1Open, setModal1Open] = useState(false);
    const [modal2Open, setModal2Open] = useState(false);
    
    return (
      <div style={{ minHeight: "100vh" }}>
        <GlobalNav
          title="Edge Case Test"
          categories={NAV_CATEGORIES}
          currentPath="/tools"
          onSignOut={() => alert("Sign out")}
          renderLink={({ href, children, onClick }) => (
            <a 
              href={href} 
              onClick={(e) => { e.preventDefault(); onClick?.(); }}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {children}
            </a>
          )}
        />
        
        <div style={{ padding: "2rem" }}>
          <Card>
            <Stack direction="vertical" gap="md">
              <Text variant="heading-sm">Edge Case Testing</Text>
              <Text variant="body" color="muted">
                Test complex scenarios:
              </Text>
              
              <Stack direction="horizontal" gap="md">
                <Tooltip content="Opens first modal - test multiple modals">
                  <Button onClick={() => setModal1Open(true)}>
                    Open Modal 1
                  </Button>
                </Tooltip>
                
                <Tooltip content="Opens second modal from first modal">
                  <Button onClick={() => setModal2Open(true)}>
                    Open Modal 2 Directly
                  </Button>
                </Tooltip>
              </Stack>
            </Stack>
          </Card>
        </div>

        {/* First modal */}
        {modal1Open && (
          <Modal 
            title="First Modal" 
            size="sm"
            onClose={() => setModal1Open(false)}
          >
            <Stack direction="vertical" gap="md">
              <Text variant="body">
                This is the first modal. You can open a second modal from here:
              </Text>
              
              <Tooltip content="This will open a second modal on top of this one">
                <Button onClick={() => setModal2Open(true)}>
                  Open Second Modal
                </Button>
              </Tooltip>
              
              <Text variant="caption" color="muted">
                Multiple modals should stack properly with the same z-index.
              </Text>
            </Stack>
          </Modal>
        )}

        {/* Second modal */}
        {modal2Open && (
          <Modal 
            title="Second Modal" 
            size="sm"
            onClose={() => setModal2Open(false)}
          >
            <Stack direction="vertical" gap="md">
              <Text variant="body">
                This second modal should appear above the first modal.
              </Text>
              <Text variant="caption" color="muted">
                Later modals in DOM order appear above earlier ones when they share the same z-index.
              </Text>
            </Stack>
          </Modal>
        )}
      </div>
    );
  },
};