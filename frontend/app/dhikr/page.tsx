import { redirect } from "next/navigation";

/** Old path — kept so bookmarks and shares of /dhikr still work. */
export default function DhikrRedirect() {
  redirect("/adhkar");
}
