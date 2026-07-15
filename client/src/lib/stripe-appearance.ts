import type { Appearance } from "@stripe/stripe-js";

// Kiddo-branded Stripe Elements theme. Stripe's appearance API resolves hex + font
// NAMES (not CSS vars), so these mirror the brand tokens in index.css:
//   evergreen #143A2C · cream #F7F3EC · brass #C68F30 · ink #1A1710 · border #E5DDD4
// Goal: turn the generic-gray default into the warm Kiddo kit so the embedded element
// reads as part of the app, not as "a Stripe checkout pasted in." Shared by the in-app
// gift modal and the checkout preview so both speak one design language.
export const kiddoStripeAppearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#143A2C",
    colorBackground: "#ffffff",
    colorText: "#1A1710",
    colorTextSecondary: "#6B6357",
    colorDanger: "#B45309",
    fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
    fontSizeBase: "16px",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #E5DDD4",
      boxShadow: "none",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid #143A2C",
      boxShadow: "0 0 0 3px rgba(20, 58, 44, 0.15)",
    },
    ".Input::placeholder": { color: "#A89F90" },
    ".Label": {
      color: "#1A1710",
      fontWeight: "600",
      fontSize: "13px",
    },
    ".Tab": {
      border: "1px solid #E5DDD4",
      boxShadow: "none",
    },
    ".Tab:hover": { backgroundColor: "#F7F3EC" },
    ".Tab--selected": {
      border: "1px solid #143A2C",
      backgroundColor: "rgba(20, 58, 44, 0.04)",
    },
    ".TabLabel--selected": { color: "#143A2C" },
    ".Tab--selected:focus": { boxShadow: "0 0 0 3px rgba(20, 58, 44, 0.15)" },
    ".Block": { border: "1px solid #E5DDD4", boxShadow: "none" },
  },
};
