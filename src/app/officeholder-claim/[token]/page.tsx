import OfficeholderClaimClient from "@/components/features/OfficeholderClaimClient";

export default async function OfficeholderClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OfficeholderClaimClient token={token} />;
}
