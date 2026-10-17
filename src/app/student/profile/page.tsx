import { redirect } from "next/navigation";

export default function StudentProfileRedirect() {
  redirect("/account/profile");
}
