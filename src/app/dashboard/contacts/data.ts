export type OrgLink = { code: string; name: string; color: string };
export type ContactOrg = { orgs: OrgLink[]; role: string };
export type Contact = {
  id: number;
  name: string;
  reference: string;
  status: "Inactive" | "Lead" | "Active";
  orgs: ContactOrg[];
  phone: string;
  email: string;
  avatar: string;
  avatarColor: string;
};

export const contacts: Contact[] = [
  {
    id: 10000627,
    name: "yayah jameh",
    reference: "10000627",
    status: "Inactive",
    orgs: [
      { orgs: [{ code: "T", name: "testing-organization-v7", color: "#c53678" }], role: "delegue" },
      { orgs: [{ code: "J", name: "Jacquet SCRL", color: "#e5322d" }], role: "Consultant" },
    ],
    phone: "—",
    email: "michel.daan@yahoo.com",
    avatar: "YJ",
    avatarColor: "#c72a4a",
  },
  {
    id: 10000626,
    name: "Mohamed Baddi",
    reference: "10000626",
    status: "Inactive",
    orgs: [
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "B", name: "Bos...", color: "#dc2626" }, { code: "LA", name: "Lacroix Asso...", color: "#c8507a" }], role: "Tech Lead" },
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "T", name: "Testing-organization-v7", color: "#2d7ff9" }], role: "Manager" },
      { orgs: [{ code: "J", name: "Jacquet SCRL", color: "#e5322d" }], role: "Consultant" },
    ],
    phone: "—",
    email: "mohamed.b@lacroix.be",
    avatar: "MB",
    avatarColor: "#6b7280",
  },
  {
    id: 10000625,
    name: "Hassan Taleb",
    reference: "10000625",
    status: "Lead",
    orgs: [
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "B", name: "Bos...", color: "#dc2626" }, { code: "LA", name: "Lacroix Asso...", color: "#c8507a" }], role: "Developer" },
      { orgs: [{ code: "EB", name: "Ecx business solutions", color: "#6366f1" }], role: "Owner" },
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "T", name: "Testing-organization-v7", color: "#2d7ff9" }], role: "Manager" },
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "B", name: "Bosmans", color: "#dc2626" }], role: "Sqd" },
      { orgs: [{ code: "HC", name: "Haifeng cable co., ltd.", color: "#0d9488" }], role: "Manager" },
      { orgs: [{ code: "J", name: "Jacquet SCRL", color: "#e5322d" }], role: "Consultant" },
    ],
    phone: "—",
    email: "hassan.t@lacroix.be",
    avatar: "HT",
    avatarColor: "#0d9488",
  },
  {
    id: 10000565,
    name: "Test for",
    reference: "10000565",
    status: "Active",
    orgs: [
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "B", name: "Bosmans", color: "#dc2626" }], role: "Testing" },
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "CS", name: "Charlier SA", color: "#dc2626" }], role: "Data Engineer" },
      { orgs: [{ code: "J", name: "Jacquet SCRL", color: "#e5322d" }], role: "Consultant" },
    ],
    phone: "MA +212645221145",
    email: "mohamed.b2211@test.com",
    avatar: "TF",
    avatarColor: "#64748b",
  },
  {
    id: 10000561,
    name: "Test for",
    reference: "10000561",
    status: "Active",
    orgs: [
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "B", name: "Bosmans", color: "#dc2626" }], role: "Testing" },
      { orgs: [{ code: "M", name: "Maes", color: "#d6458a" }, { code: "B", name: "Bosmans", color: "#dc2626" }], role: "Testing" },
      { orgs: [{ code: "J", name: "Jacquet SCRL", color: "#e5322d" }], role: "Consultant" },
    ],
    phone: "MA +212645221145",
    email: "mohamed.b2211@test.com",
    avatar: "TF",
    avatarColor: "#64748b",
  },
];

export function findContact(id: string | number) {
  const num = Number(id);
  return contacts.find((c) => c.id === num || c.reference === String(id)) ?? contacts[0];
}
