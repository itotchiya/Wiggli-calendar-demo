export type OrganizationLink = { code: string; name: string; color: string };

const organizationColors: Record<string, string> = {
  "Jacquet SCRL": "#e5322d",
  "General Motors": "#2563eb",
  "Nova Systems": "#7c3aed",
  "Cobalt Industries": "#d97706",
  "Zephyr Labs": "#0d9488",
};

function toOrganizationLinks(organization: string): OrganizationLink[] {
  return organization.split(/\s*[>›]\s*/).filter(Boolean).map((name, index) => ({
    name,
    code: name === "Jacquet SCRL" ? "J" : name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    color: organizationColors[name] ?? ["#d6458a", "#2d7ff9", "#7c3aed", "#0d9488"][index % 4],
  }));
}

export function OrganizationChain({ organization, organizations }: { organization?: string; organizations?: OrganizationLink[] }) {
  if ((!organization || organization === "—") && !organizations?.length) return <>—</>;
  const links = organizations?.length ? organizations : toOrganizationLinks(organization!);
  return (
    <span className="contact-org-chain">
      {links.map((org, index) => (
        <span className="contact-org-chain-item" key={`${org.code}-${org.name}-${index}`}>
          <span className="contact-org-pill" style={{ background: org.color }}>{org.code}</span>
          <span className={index === links.length - 1 ? "contact-org-link" : ""}>{org.name}</span>
          {index < links.length - 1 && <span className="contact-org-sep">›</span>}
        </span>
      ))}
    </span>
  );
}
