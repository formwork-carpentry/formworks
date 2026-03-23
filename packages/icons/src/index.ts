export interface IIconProps {
  size?: number;
  className?: string;
  title?: string;
}

function baseSvg(path: string, props: IIconProps = {}): string {
  const size = props.size ?? 20;
  const classAttr = props.className ? ` class=\"${props.className}\"` : "";
  const title = props.title ? `<title>${props.title}</title>` : "";
  return `<svg${classAttr} width=\"${size}\" height=\"${size}\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">${title}${path}</svg>`;
}

export function IconHome(props: IIconProps = {}): string {
  return baseSvg('<path d="M3 11.5L12 4L21 11.5V20H14V14H10V20H3V11.5Z" stroke="currentColor" stroke-width="1.8"/>', props);
}

export function IconSearch(props: IIconProps = {}): string {
  return baseSvg('<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M20 20L16.6 16.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', props);
}

export function IconUser(props: IIconProps = {}): string {
  return baseSvg('<circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M5 20C5 16.8 7.7 14.5 11 14.5H13C16.3 14.5 19 16.8 19 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', props);
}

export function FlagUS(props: IIconProps = {}): string {
  return baseSvg('<rect x="2" y="4" width="20" height="16" rx="2" fill="#B22234"/><rect x="2" y="6" width="20" height="2" fill="#FFFFFF"/><rect x="2" y="10" width="20" height="2" fill="#FFFFFF"/><rect x="2" y="14" width="20" height="2" fill="#FFFFFF"/><rect x="2" y="18" width="20" height="2" fill="#FFFFFF"/><rect x="2" y="4" width="9" height="8" fill="#3C3B6E"/>', props);
}

export function FlagGB(props: IIconProps = {}): string {
  return baseSvg('<rect x="2" y="4" width="20" height="16" rx="2" fill="#1F3B8C"/><path d="M2 6L8 10M22 6L16 10M2 18L8 14M22 18L16 14" stroke="#FFFFFF" stroke-width="2"/><path d="M11 4V20M2 12H22" stroke="#FFFFFF" stroke-width="3"/><path d="M11 4V20M2 12H22" stroke="#C8102E" stroke-width="1.4"/>', props);
}

export function FlagDE(props: IIconProps = {}): string {
  return baseSvg('<rect x="2" y="4" width="20" height="16" rx="2" fill="#000000"/><rect x="2" y="9.3" width="20" height="5.4" fill="#DD0000"/><rect x="2" y="14.7" width="20" height="5.3" fill="#FFCE00"/>', props);
}
