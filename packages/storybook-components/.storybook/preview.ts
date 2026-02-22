import type { Preview } from "@storybook/react-vite";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "subtle", value: "#f8fafc" },
      ],
    },
  },
};

export default preview;
