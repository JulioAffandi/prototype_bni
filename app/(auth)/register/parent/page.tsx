import { redirect } from "next/navigation";

export default function RegisterParentRedirect() {
  redirect("/register?role=parent");
}
