// Icon component wrapper
const Icon = ({ children, size = 24, color = "currentColor", ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    fill={color}
    {...props}
  >
    {children}
  </svg>
);

export const Logout = (props) => (
  <Icon {...props}>
    <path d="M0 0h24v24H0z" fill="none" />
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
  </Icon>
);

export const Update = (props) => (
  <Icon {...props}>
    <path d="M0 0h24v24H0z" fill="none" />
    <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79 2.73 2.71 7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58 3.51-3.47 9.14-3.47 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z" />
  </Icon>
);

export const GppBad = (props) => (
  <Icon {...props}>
    <path d="M0,0h24v24H0V0z" fill="none" />
    <path d="M12,2L4,5v6.09c0,5.05,3.41,9.76,8,10.91c4.59-1.15,8-5.86,8-10.91V5L12,2z M15.5,14.09l-1.41,1.41L12,13.42L9.91,15.5 L8.5,14.09L10.59,12L8.5,9.91L9.91,8.5L12,10.59l2.09-2.09l1.41,1.41L13.42,12L15.5,14.09z" />
  </Icon>
);

export const BrowserUpdated = (props) => (
  <Icon {...props}>
    <path d="M0 0h24v24H0z" fill="none" />
    <path d="M22 3H2C.9 3 0 3.9 0 5v14c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM2 19V8h20v11H2z" />
    <path d="M12 15.5L9.5 13l1.41-1.41L12 12.67l3.59-3.58L17 10.5 12 15.5z" />
  </Icon>
);
