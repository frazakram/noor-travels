import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ surah: string }>;
  searchParams: Promise<{ ayah?: string }>;
};

export default async function ListenSurahRedirect({ params, searchParams }: Props) {
  const { surah } = await params;
  const { ayah } = await searchParams;
  redirect(ayah ? `/quran/${surah}?ayah=${ayah}` : `/quran/${surah}`);
}
