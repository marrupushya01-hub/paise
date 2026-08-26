import Money from "@/screens/Money";

export const metadata = { title: "Money · Paise" };

// `?tab=insights` deep-links the Insights tab — that's where the Home
// assistant cards send you.
export default async function MoneyPage({ searchParams }) {
  const params = await searchParams;
  return <Money initialTab={params?.tab === "insights" ? "insights" : "flow"} />;
}
