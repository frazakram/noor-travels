import { redirect } from "next/navigation";

export default function TravelDuasRedirect() {
  redirect("/hadith?section=duas&category=travel");
}
