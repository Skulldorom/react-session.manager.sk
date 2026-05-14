import React from "react";
import { render } from "@testing-library/react";
import { Logout, Update, GppBad, BrowserUpdated } from "../src/components/Icons.js";

describe("Icon components", () => {
  const icons = [
    { name: "Logout", Component: Logout },
    { name: "Update", Component: Update },
    { name: "GppBad", Component: GppBad },
    { name: "BrowserUpdated", Component: BrowserUpdated },
  ];

  icons.forEach(({ name, Component }) => {
    describe(name, () => {
      it("renders an SVG element", () => {
        const { container } = render(<Component />);
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
      });

      it("applies the default size of 24", () => {
        const { container } = render(<Component />);
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("width", "24");
        expect(svg).toHaveAttribute("height", "24");
      });

      it("accepts a custom size prop", () => {
        const { container } = render(<Component size={48} />);
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("width", "48");
        expect(svg).toHaveAttribute("height", "48");
      });

      it("applies the default fill color", () => {
        const { container } = render(<Component />);
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("fill", "currentColor");
      });

      it("accepts a custom color prop", () => {
        const { container } = render(<Component color="red" />);
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("fill", "red");
      });

      it("uses the correct viewBox", () => {
        const { container } = render(<Component />);
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      });
    });
  });
});
